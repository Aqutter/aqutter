import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'bundle_archive.dart';
import 'bundle_signature.dart';
import 'host_requirement.dart';
import 'host_version.dart';
import 'seed_bootstrapper.dart';
import 'update_config.dart';

/// 網頁包下載進度回呼；單位為位元組，[total] 為 -1 表示伺服器未提供 content-length。
typedef BundleDownloadProgress = void Function(int received, int total);

/// 遠端版本資訊（`version.json`）。
class RemoteVersion {
  RemoteVersion({required this.version, required this.url, required this.sha256, this.signature, this.size, this.host});

  /// [platform] 供 `host` 區塊挑平台覆寫；`host` 缺席即無殼版本要求。
  factory RemoteVersion.fromJson(Map<String, dynamic> json, {required String platform}) {
    final host = json['host'];
    return RemoteVersion(
      version: json['version'] as String,
      url: json['url'] as String,
      sha256: json['sha256'] as String?,
      signature: json['signature'] as String?,
      size: _asInt(json['size']),
      host: host is Map<String, dynamic> ? HostRequirement.fromJson(host, platform: platform) : null,
    );
  }

  static int? _asInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is String) {
      return int.tryParse(value.trim());
    }
    return null;
  }

  /// 版本識別（與本地 current/version.json 的 version 比對）。
  final String version;

  /// bundle.zip 下載網址。
  final String url;

  /// bundle.zip 的 sha256（十六進位）；null 表示不驗證。
  final String? sha256;

  /// 對「版本＋sha256」的 Ed25519 簽章（Base64）；只在殼設了公鑰時才被檢查。
  final String? signature;

  /// bundle.zip 大小（bytes）；供下載前顯示，null 表示伺服器未宣告。
  /// 下載期間仍以 content-length 為準，只在其缺席時回退用這個值。
  final int? size;

  /// 殼版本要求（已合併本機平台的覆寫）；null 表示伺服器未宣告。
  final HostRequirement? host;
}

/// 解包前的完整性與來源驗證；失敗丟出 [StateError]，呼叫端不得解包。
///
/// 沒設公鑰（[verifier] 為 null）：只看雜湊（有就驗、沒有就不驗），與簽章功能出現之前相同。
/// 設了公鑰：雜湊與簽章缺一不可，雜湊對得上才驗簽——簽章綁的是「版本＋這份位元組的雜湊」。
@visibleForTesting
Future<void> verifyBundleBytes(
  List<int> bytes,
  RemoteVersion remote, {
  required BundleSignatureVerifier? verifier,
}) async {
  final expected = remote.sha256;
  if (verifier == null) {
    if (expected != null) {
      _checkHash(bytes, expected);
    }
    return;
  }
  if (expected == null) {
    throw StateError('Bundle sha256 missing: it is required when signing keys are configured');
  }
  _checkHash(bytes, expected);
  await verifier.verify(version: remote.version, sha256Hex: expected, signature: remote.signature);
}

void _checkHash(List<int> bytes, String expectedSha256) {
  final actual = sha256.convert(bytes).toString();
  if (actual != expectedSha256.toLowerCase()) {
    throw StateError('Bundle sha256 mismatch: expected $expectedSha256, got $actual');
  }
}

/// 嚴格模式（`AQUTTER_UPDATE_REQUIRED=true`）下版本查詢或套用失敗；[BundleManager.checkForUpdate]
/// 拋出，呼叫端應阻擋進入網頁並提供重試。
///
/// 獨立型別而非直接讓底層例外往上：非嚴格模式下同一批例外代表「續用舊版即可」，
/// 兩種語意必須在型別上分開，呼叫端才不用靠旗標二次判斷。
class UpdateCheckFailedException implements Exception {
  const UpdateCheckFailedException(this.cause);

  /// 底層的原始例外（連線、逾時、HTTP 錯誤、回應格式錯、雜湊不符…）。
  final Object cause;

  @override
  String toString() {
    return 'UpdateCheckFailedException: $cause';
  }
}

/// [BundleManager.check] 的結果：一次查詢同時回答「有沒有新網頁包」與「殼夠不夠新」。
///
/// 殼過舊在此是**資料**而非例外：網頁端只是查詢時，要的是能自行顯示的事實；
/// 真正的阻擋由要下載／套用的那條路徑依 [hostBlocked] 決定。
class UpdateCheckResult {
  const UpdateCheckResult({
    required this.localVersion,
    required this.remote,
    required this.host,
    required this.hasUpdate,
    required this.hostBlocked,
  });

  /// 本機 `current/version.json` 的版本；首開或無版本標記時為 null。
  final String? localVersion;

  /// 伺服器回應。
  final RemoteVersion remote;

  /// 本機殼版本。
  final HostVersion host;

  /// 遠端網頁包是否比本機新。
  final bool hasUpdate;

  /// 伺服器宣告的最低殼 build 是否高於本機。
  final bool hostBlocked;

  /// 殼被擋時對應的例外；供仍需以例外分流的呼叫端（冷啟）使用。
  HostTooOldException get hostTooOld => HostTooOldException(requirement: remote.host!, host: host);
}

/// 網頁包管理：可寫服務根、首次種子、以及熱更新（下載→解壓→原子換名）。
class BundleManager {
  BundleManager({Dio? dio, SeedBootstrapper? seed, this.signatureVerifier})
    : _dio = dio ?? Dio(BaseOptions(
        connectTimeout: connectTimeout,
        receiveTimeout: receiveTimeout,
      )),
      _seed = seed ?? SeedBootstrapper();

  final Dio _dio;
  final SeedBootstrapper _seed;

  /// 非 null 時，下載的網頁包必須帶有效簽章才會解包；null 代表沒設公鑰、不驗簽章。
  final BundleSignatureVerifier? signatureVerifier;

  /// 連線逾時。此流程位於啟動路徑上，斷線時若無上限會把冷啟一路拖到 OS 的
  /// socket 預設（Android 約 130 秒），故取一個使用者仍願意等的短上限。
  ///
  /// 這個值刻意**不跟著接收逾時一起放寬**：連不上就是連不上，等再久也不會變成連得上。
  /// 以 `AQUTTER_UPDATE_CONNECT_TIMEOUT_SECONDS` 調整（見專案的 .env 範例）。
  static const Duration connectTimeout = Duration(
    seconds: int.fromEnvironment('AQUTTER_UPDATE_CONNECT_TIMEOUT_SECONDS', defaultValue: 30),
  );

  /// 接收逾時。網頁包可達數 MB，需比連線逾時寬鬆得多。
  ///
  /// 寧可高不可低：這個值砍掉的是**已經在下載中**的更新，代價與就緒誤判同級。
  /// 以 `AQUTTER_UPDATE_RECEIVE_TIMEOUT_SECONDS` 調整（見專案的 .env 範例）。
  static const Duration receiveTimeout = Duration(
    seconds: int.fromEnvironment('AQUTTER_UPDATE_RECEIVE_TIMEOUT_SECONDS', defaultValue: 600),
  );

  /// 遠端更新的解壓暫存區。
  static const String _updateStagingDir = 'next';

  /// 種子解壓的暫存區；與遠端更新分開，避免中斷殘留的暫存互相污染。
  static const String _seedStagingDir = 'seed-next';

  /// 前一版網頁包的保留位置。套用更新時由 `current/` 換名而來，供回滾使用。
  static const String _previousDir = 'previous';

  Future<Directory> _webRoot() async {
    final support = await getApplicationSupportDirectory();
    return Directory(p.join(support.path, 'web'));
  }

  Future<Directory> _currentDir() async {
    final root = await _webRoot();
    return Directory(p.join(root.path, 'current'));
  }

  Future<Directory> _previousBundleDir() async {
    final root = await _webRoot();
    return Directory(p.join(root.path, _previousDir));
  }

  Future<Directory> _stagingDir(String name) async {
    final root = await _webRoot();
    return Directory(p.join(root.path, name));
  }

  /// 服務根的絕對路徑；不觸發任何種子或更新檢查。
  Future<String> currentPath() async => (await _currentDir()).path;

  /// 目前服務中的網頁包版本；無版本標記時為 null。
  Future<String?> currentVersion() async => readBundleVersion(await _currentDir());

  /// App 內建種子的版本；無版本標記時為 null。
  Future<String?> seedVersion() => _seed.readSeedVersion();

  /// 確保服務根就緒（首開解壓種子，或以較新的種子覆蓋），回傳 `current/` 絕對路徑。
  Future<String> ensureCurrent({BundleExtractProgress? onExtractProgress}) async {
    final current = await _currentDir();
    await current.create(recursive: true);
    await _seed.ensureSeed(
      currentDir: current,
      stagingDir: await _stagingDir(_seedStagingDir),
      onExtractProgress: onExtractProgress,
    );
    return current.path;
  }

  /// [remote] 是否比 [local] 新（版本為 YYMMDDHHmmss 定長時戳，字典序即時序）。
  ///
  /// 刻意是「大於」而非「不相等」：種子與 OTA 是兩個獨立的無狀態判斷，若 OTA 接受
  /// 較舊的遠端版本，遇上帶有較新種子的 APK 會形成互踩——每次冷啟都「種子覆蓋 →
  /// OTA 蓋回舊版」，反覆付出完整解壓與完整下載的代價，使用者還永遠停在舊版。
  ///
  /// 代價是伺服器無法再以「調低版本號」做 rollback，改為把舊內容以新時戳重新發佈。
  bool _isNewer(String remote, String? local) {
    if (local == null) {
      return true;
    }
    return remote.compareTo(local) > 0;
  }

  Future<void> _verifyBundle(List<int> bytes, RemoteVersion remote) {
    return verifyBundleBytes(bytes, remote, verifier: signatureVerifier);
  }

  /// 解包完成的標記檔；只有它存在，`next/` 才算「待套用」。
  ///
  /// 解包是逐檔寫出的，中途被殺會留下半套內容——而 zip 內 `version.json` 未必排在
  /// 最後，單看它存不存在無法分辨「解完了」與「解到一半」。
  static const String _pendingMarkerFile = '.ready';

  /// 查詢遠端版本並與本機比對；**不下載、不動任何檔案**。
  ///
  /// 殼版本要求在**比對網頁包版本之前**就判定並以 [UpdateCheckResult.hostBlocked] 回報：
  /// 強制更新殼是伺服器驅動的決定，不該因為「這次剛好沒有新網頁包」而被略過。
  ///
  /// [BundleUpdateConfig.requireVersionCheck] 開啟時，查詢失敗包成
  /// [UpdateCheckFailedException]——呼叫端據此區分「不准繼續、可重試」與一般的
  /// 「這次查不到、續用舊版」。判定放在這裡而非畫面層：什麼算查詢失敗，
  /// 與 [BundleUpdateConfig.enabled] 的判斷本就該住在同一處。
  ///
  /// [config] 未啟用時拋 [StateError]；呼叫端應先看 [BundleUpdateConfig.enabled]。
  Future<UpdateCheckResult> check(BundleUpdateConfig config) {
    if (!config.enabled) {
      throw StateError('Bundle update is not configured (AQUTTER_UPDATE_BASE_URL is empty)');
    }
    return _guardStrict(config, () async {
      final localVersion = await readBundleVersion(await _currentDir());
      final host = await HostVersion.load();
      final remote = await _fetchRemoteVersion(config, localVersion, host);
      final requirement = remote.host;
      return UpdateCheckResult(
        localVersion: localVersion,
        remote: remote,
        host: host,
        hasUpdate: _isNewer(remote.version, localVersion),
        hostBlocked: requirement != null && requirement.blocks(host),
      );
    });
  }

  /// 下載 [remote] 指向的網頁包、驗 sha256、解包到 `next/`；完成後即為「待套用」。
  ///
  /// 全程不碰 `current/`，故可在網頁仍在服務時於背景進行；換上由 [applyPending] 另行執行。
  ///
  /// [onProgress] 與 [onExtractProgress] 逐位元組／逐項回報，**節流是呼叫端的責任**。
  /// 伺服器未提供 content-length 時 [onProgress] 的 total 為 -1，此時以
  /// [RemoteVersion.size] 補上——它就是為了「下載前與 content-length 缺席時」而存在的。
  /// [onVerifying] 在下載結束、開始驗 sha256 之前呼叫一次。
  ///
  /// 失敗時 `next/` 不會帶有標記檔，[applyPending] 會把它當作殘渣清掉。
  Future<void> download(
    BundleUpdateConfig config,
    RemoteVersion remote, {
    BundleDownloadProgress? onProgress,
    void Function()? onVerifying,
    BundleExtractProgress? onExtractProgress,
  }) {
    return _guardStrict(config, () async {
      final bytes = await _downloadBundle(config, remote, _withSizeFallback(onProgress, remote.size));
      onVerifying?.call();
      await _verifyBundle(bytes, remote);

      final staging = await _stagingDir(_updateStagingDir);
      await extractBundle(staging, bytes, onProgress: onExtractProgress);
      await File(p.join(staging.path, _pendingMarkerFile)).writeAsString(remote.version);
    });
  }

  /// `next/` 是否為一份完整、待套用的網頁包。
  Future<bool> hasPending() async {
    final staging = await _stagingDir(_updateStagingDir);
    return File(p.join(staging.path, _pendingMarkerFile)).exists();
  }

  /// 把 `next/` 換上 `current/`（舊版保留為 `previous/`）；回傳是否真的換了。
  ///
  /// 沒有完整的 `next/` 時回傳 false 並清掉殘渣（半套解包、或標記檔缺席的舊暫存）。
  /// [onlyIfNewer] 為 true 時另比對版本：`next/` 不比 `current/` 新就丟棄——用於冷啟
  /// 收拾「下載完卻沒套用就被殺」的殘留，此時種子可能已把 `current/` 換成更新的版本。
  Future<bool> applyPending({bool onlyIfNewer = false}) async {
    final staging = await _stagingDir(_updateStagingDir);
    if (!await hasPending()) {
      if (await staging.exists()) {
        await staging.delete(recursive: true);
      }
      return false;
    }
    final current = await _currentDir();
    if (onlyIfNewer) {
      final pendingVersion = await readBundleVersion(staging);
      final localVersion = await readBundleVersion(current);
      if (pendingVersion == null || !_isNewer(pendingVersion, localVersion)) {
        await staging.delete(recursive: true);
        return false;
      }
    }
    // 標記檔不該進服務根：它是暫存區的內部狀態，換上後就沒有意義
    await File(p.join(staging.path, _pendingMarkerFile)).delete();
    await commitBundle(staging, current, previous: await _previousBundleDir());
    return true;
  }

  /// 冷啟的一條龍：查版本 → 有新版就下載並立即套用；回傳是否換了版本。
  ///
  /// 殼過舊拋 [HostTooOldException]（在下載之前）；嚴格模式的失敗由 [check] / [download]
  /// 包成 [UpdateCheckFailedException]。這是 [check] + [download] + [applyPending] 的組合，
  /// 給沒有網頁在看、也不需要分段控制的呼叫端用。
  Future<bool> checkForUpdate(
    BundleUpdateConfig config, {
    BundleDownloadProgress? onProgress,
    BundleExtractProgress? onExtractProgress,
  }) async {
    if (!config.enabled) {
      return false;
    }
    final result = await check(config);
    if (result.hostBlocked) {
      throw result.hostTooOld;
    }
    if (!result.hasUpdate) {
      return false;
    }
    await download(config, result.remote, onProgress: onProgress, onExtractProgress: onExtractProgress);
    return applyPending();
  }

  /// 嚴格模式下把任何失敗包成 [UpdateCheckFailedException]；殼過舊維持原型別。
  Future<T> _guardStrict<T>(BundleUpdateConfig config, Future<T> Function() body) async {
    if (!config.requireVersionCheck) {
      return body();
    }
    try {
      return await body();
    }
    on HostTooOldException {
      rethrow;
    }
    catch (e) {
      throw UpdateCheckFailedException(e);
    }
  }

  /// content-length 缺席（total 為 -1）時以伺服器宣告的 [size] 補上，讓進度仍可定量。
  BundleDownloadProgress? _withSizeFallback(BundleDownloadProgress? onProgress, int? size) {
    if (onProgress == null || size == null) {
      return onProgress;
    }
    return (received, total) => onProgress(received, total > 0 ? total : size);
  }

  /// 回滾到前一版網頁包；回傳是否真的回滾了。
  ///
  /// 用於「下載與解壓都成功、網頁包卻起不來」——那是 [applyPending] 的
  /// rollback 安全涵蓋不到的缺口：它保護的是換上之前的失敗，換上之後就換它接手。
  Future<bool> rollbackToPrevious() async {
    return rollbackBundle(await _currentDir(), await _previousBundleDir());
  }

  /// 查詢遠端版本資訊。
  ///
  /// GET / POST 共用 `request()` 這一條路徑，method 交由 [Options] 決定，
  /// 避免兩種模式各長出一條會逐漸分歧的分支。
  Future<RemoteVersion> _fetchRemoteVersion(
    BundleUpdateConfig config,
    String? localVersion,
    HostVersion host,
  ) async {
    final isPost = config.method == UpdateHttpMethod.post;
    final response = await _dio.request<String>(
      config.versionUri.toString(),
      data: isPost ? _versionRequestBody(localVersion, host) : null,
      options: Options(
        method: config.method.wireName,
        headers: config.authHeaders,
      ),
    );
    return RemoteVersion.fromJson(
      jsonDecode(response.data ?? '{}') as Map<String, dynamic>,
      platform: Platform.operatingSystem,
    );
  }

  /// POST 模式的 request body。
  ///
  /// 送出 client 現況讓伺服器能做灰度或分眾；[localVersion] 為 null 表示首開或
  /// 無版本標記，伺服器應視為最舊。殼版本一併上行，伺服器才能決定要不要回
  /// `host.minBuildNumber` 強制更新殼。GET 模式不帶 body。
  Map<String, dynamic> _versionRequestBody(String? localVersion, HostVersion host) {
    return <String, dynamic>{
      'currentVersion': localVersion,
      'platform': Platform.operatingSystem,
      'hostVersion': host.name,
      'hostBuildNumber': host.buildNumber,
    };
  }

  /// 下載網頁包；URL 由版本回應給定，一律為 GET。
  ///
  /// 是否附上鑑權 header 由 [BundleUpdateConfig.authorizeBundleDownload] 決定——
  /// zip 可能指向第三方 CDN，無條件帶 KEY 等於把憑證送給該網域。
  Future<List<int>> _downloadBundle(
    BundleUpdateConfig config,
    RemoteVersion remote,
    BundleDownloadProgress? onProgress,
  ) async {
    final response = await _dio.get<List<int>>(
      remote.url,
      options: Options(
        responseType: ResponseType.bytes,
        headers: config.authorizeBundleDownload ? config.authHeaders : null,
      ),
      onReceiveProgress: onProgress,
    );
    return response.data ?? const [];
  }
}
