import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../bridge/bridge_names.dart';
import 'bundle_manager.dart';
import 'host_requirement.dart';
import 'update_config_store.dart';

/// APK 下載進度回呼；單位為位元組，[total] 為 -1 表示伺服器未提供 content-length。
typedef HostDownloadProgress = void Function(int received, int total);

/// 殼（原生二進位）的更新管道。
///
/// 與 [BundleManager] 分開：後者管網頁包，殼二進位是另一個生命週期——它不需要
/// staging / 原子換名 / 回滾，換完就是整個程序被系統換掉。
class HostUpdater {
  HostUpdater({required this.configStore})
    : _dio = Dio(BaseOptions(
        connectTimeout: BundleManager.connectTimeout,
        receiveTimeout: BundleManager.receiveTimeout,
      ));

  /// 沿用 OTA 的鑑權設定：APK 多半與網頁包放在同一個私有伺服器，
  /// `AQUTTER_UPDATE_BUNDLE_AUTH` 的取捨（第三方 CDN 不帶 KEY）在此同樣成立。
  ///
  /// 持有的是 [UpdateConfigStore] 而非設定本身：網頁端切換版更伺服器後，下載要用新的鑑權。
  final UpdateConfigStore configStore;

  final Dio _dio;

  static const MethodChannel _hostChannel = MethodChannel(HostMethod.channel);

  /// cache 目錄下的暫存子目錄；與 `res/xml/file_paths.xml` 的白名單對應。
  static const String _cacheSubdir = 'host-update';
  static const String _apkFileName = 'update.apk';

  /// [requirement] 是否走「App 內下載 APK」這條管道；其餘一律開外部連結。
  static bool usesApk(HostRequirement requirement) {
    return requirement.updateType == HostUpdateType.apk && Platform.isAndroid;
  }

  /// 依 [requirement] 的管道執行更新（一條龍）。
  ///
  /// - `external`（或非 Android 收到 `apk`）：開外部連結後即回傳，之後的流程在 App 外。
  /// - `apk`：[download] → [install]。回傳時安裝器已在前景；使用者取消
  ///   回來後阻擋畫面仍在，再呼叫一次會直接沿用已下載且驗過的檔案。
  ///
  /// [requirement.updateUrl] 為 null 時拋 [StateError]——呼叫端本就不該在無 URL 時顯示按鈕。
  Future<void> start(HostRequirement requirement, {HostDownloadProgress? onProgress}) async {
    if (!usesApk(requirement)) {
      await _openExternal(_requireUrl(requirement));
      return;
    }
    await install(await download(requirement, onProgress: onProgress));
  }

  /// 下載並驗證 APK，回傳檔案；**不喚起安裝器**，供網頁端「先下載、再決定何時安裝」。
  ///
  /// 已有驗過的檔案就直接回傳。伺服器未提供 content-length 時 [onProgress] 的 total
  /// 以 [HostRequirement.updateSize] 補上。只在 [usesApk] 為 true 時有意義，否則拋 [StateError]。
  ///
  /// [onVerifying] 在下載結束、開始驗 sha256 之前呼叫一次；APK 動輒上百 MB，雜湊要算一陣子。
  Future<File> download(
    HostRequirement requirement, {
    HostDownloadProgress? onProgress,
    void Function()? onVerifying,
  }) {
    if (!usesApk(requirement)) {
      throw StateError('Host update via APK is only available on Android with updateType=apk');
    }
    return _ensureApk(
      _requireUrl(requirement),
      requirement.updateSha256,
      _withSizeFallback(onProgress, requirement.updateSize),
      onVerifying,
    );
  }

  /// 喚起系統安裝器安裝 [apk]（Android 限定）。
  Future<void> install(File apk) {
    return _hostChannel.invokeMethod<void>(HostMethod.installApk, {'path': apk.path});
  }

  String _requireUrl(HostRequirement requirement) {
    final url = requirement.updateUrl;
    if (url == null) {
      throw StateError('HostRequirement.updateUrl is null');
    }
    return url;
  }

  /// content-length 缺席（total 為 -1）時以伺服器宣告的 [size] 補上，讓進度仍可定量。
  HostDownloadProgress? _withSizeFallback(HostDownloadProgress? onProgress, int? size) {
    if (onProgress == null || size == null) {
      return onProgress;
    }
    return (received, total) => onProgress(received, total > 0 ? total : size);
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.parse(url);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      throw StateError('No application can open $url');
    }
  }

  /// 已有驗過的檔案就直接用；否則下載並驗證。驗證失敗一律刪檔，避免下次誤用半截檔。
  Future<File> _ensureApk(
    String url,
    String? expectedSha256,
    HostDownloadProgress? onProgress, [
    void Function()? onVerifying,
  ]) async {
    final file = await _apkFile();
    if (await file.exists() && await _matches(file, expectedSha256)) {
      return file;
    }
    await file.parent.create(recursive: true);
    final config = configStore.current;
    try {
      await _dio.download(
        url,
        file.path,
        options: Options(headers: config.authorizeBundleDownload ? config.authHeaders : null),
        onReceiveProgress: onProgress,
      );
      onVerifying?.call();
      if (!await _matches(file, expectedSha256)) {
        throw StateError('APK sha256 mismatch; expected $expectedSha256');
      }
      return file;
    }
    catch (_) {
      if (await file.exists()) {
        await file.delete();
      }
      rethrow;
    }
  }

  /// [expectedSha256] 為 null 時視為相符：伺服器沒給就無從驗，與網頁包的語意一致。
  Future<bool> _matches(File file, String? expectedSha256) async {
    if (expectedSha256 == null) {
      return true;
    }
    final digest = await sha256.bind(file.openRead()).first;
    return digest.toString() == expectedSha256.toLowerCase();
  }

  Future<File> _apkFile() async {
    final cache = await getApplicationCacheDirectory();
    return File(p.join(cache.path, _cacheSubdir, _apkFileName));
  }
}
