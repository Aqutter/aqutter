import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/server/bundle_archive.dart';
import 'package:aqutter/src/server/bundle_manager.dart';
import 'package:aqutter/src/server/host_requirement.dart';
import 'package:aqutter/src/server/host_updater.dart';
import 'package:aqutter/src/server/host_version.dart';
import 'package:aqutter/src/server/update_config.dart';
import 'package:aqutter/src/server/update_config_store.dart';
import 'package:aqutter/src/server/update_session.dart';

const _config = BundleUpdateConfig(baseUrl: 'https://example.com/app');
final _store = UpdateConfigStore(defaults: _config);
const _host = HostVersion(name: '1.0.0', buildNumber: 3, buildNumberRaw: '3');

/// 以固定結果取代網路與檔案系統：本檔測的是狀態機的轉換與節流，不是下載本身。
class _FakeBundleManager extends BundleManager {
  _FakeBundleManager({
    required this.result,
    this.downloadTotal = 1000,
    this.pending = false,
    this.reportsTotal = true,
    this.hashMismatch = false,
  });

  final UpdateCheckResult result;
  final int downloadTotal;

  /// false 模擬伺服器沒給 content-length、版本回應也沒給 size：dio 回報 total 為 -1。
  final bool reportsTotal;

  /// true 模擬 sha256 不符：驗證階段拋錯，不進解包。
  final bool hashMismatch;

  /// 解包項目數；固定值即可，解包總數一定已知。
  final int extractTotal = 10;
  bool pending;

  @override
  Future<UpdateCheckResult> check(BundleUpdateConfig config) async => result;

  @override
  Future<void> download(
    BundleUpdateConfig config,
    RemoteVersion remote, {
    BundleDownloadProgress? onProgress,
    void Function()? onVerifying,
    BundleExtractProgress? onExtractProgress,
  }) async {
    // 逐位元組回報，模擬 dio 的密集回呼
    for (var received = 1; received <= downloadTotal; received++) {
      onProgress?.call(received, reportsTotal ? downloadTotal : -1);
    }
    onVerifying?.call();
    if (hashMismatch) {
      throw StateError('Bundle sha256 mismatch');
    }
    for (var done = 1; done <= extractTotal; done++) {
      onExtractProgress?.call(done, extractTotal);
    }
    pending = true;
  }

  @override
  Future<bool> hasPending() async => pending;
}

class _FakeHostUpdater extends HostUpdater {
  _FakeHostUpdater() : super(configStore: _store);

  int installs = 0;

  @override
  Future<File> download(
    HostRequirement requirement, {
    HostDownloadProgress? onProgress,
    void Function()? onVerifying,
  }) async {
    onProgress?.call(50, 100);
    onProgress?.call(100, 100);
    return File('update.apk');
  }

  @override
  Future<void> install(File apk) async => installs++;
}

UpdateCheckResult _result({
  bool hasUpdate = true,
  bool hostBlocked = false,
  HostRequirement? host,
  int? size,
}) {
  return UpdateCheckResult(
    localVersion: '260901000000',
    remote: RemoteVersion(
      version: '260902000000',
      url: 'https://example.com/b.zip',
      sha256: null,
      size: size,
      host: host,
    ),
    host: _host,
    hasUpdate: hasUpdate,
    hostBlocked: hostBlocked,
  );
}

/// 讓背景流程的 microtask 跑完。
Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  late List<UpdateState> states;
  late int applies;
  late List<Object> blocked;

  UpdateSession session(
    _FakeBundleManager bundle, {
    _FakeHostUpdater? hostUpdater,
    bool devMode = false,
    UpdateConfigStore? configStore,
  }) {
    states = [];
    applies = 0;
    blocked = [];
    return UpdateSession(
      bundle: bundle,
      hostUpdater: hostUpdater ?? _FakeHostUpdater(),
      configStore: configStore ?? UpdateConfigStore(defaults: _config),
      devMode: devMode,
      onState: states.add,
      onApplyBundle: () async => applies++,
      onHostTooOld: blocked.add,
      onCheckFailed: blocked.add,
    );
  }

  List<UpdateStage> stagesOf(UpdateTarget target) {
    return states.where((s) => s.target == target).map((s) => s.stage).toList();
  }

  group('requestBundleDownload', () {
    test('apply:true 走完 checking → available → downloading → extracting → ready → applying', () async {
      final s = session(_FakeBundleManager(result: _result()));
      expect(s.requestBundleDownload(apply: true).accepted, isTrue);
      await _settle();
      final stages = stagesOf(UpdateTarget.bundle);
      expect(stages.first, UpdateStage.checking);
      expect(stages[1], UpdateStage.available);
      expect(stages, contains(UpdateStage.downloading));
      // 驗證夾在下載與解包之間
      final verifying = stages.indexOf(UpdateStage.verifying);
      expect(verifying, greaterThan(stages.lastIndexOf(UpdateStage.downloading)));
      expect(verifying, lessThan(stages.indexOf(UpdateStage.extracting)));
      expect(stages[stages.length - 2], UpdateStage.ready);
      expect(stages.last, UpdateStage.applying);
      expect(applies, 1);
    });

    test('apply:false 停在 ready，不呼叫套用', () async {
      final s = session(_FakeBundleManager(result: _result()));
      s.requestBundleDownload(apply: false);
      await _settle();
      expect(stagesOf(UpdateTarget.bundle).last, UpdateStage.ready);
      expect(applies, 0);
    });

    test('下載進度以整數百分比節流：1000 次回呼只放行約 100 次', () async {
      final s = session(_FakeBundleManager(result: _result(), downloadTotal: 1000));
      s.requestBundleDownload(apply: false);
      await _settle();
      final downloading = states.where((st) => st.stage == UpdateStage.downloading).toList();
      // 起始的 0% 快照 + 1%..100%
      expect(downloading.length, inInclusiveRange(100, 102));
      expect(downloading.last.received, 1000);
      expect(downloading.last.total, 1000);
      expect(downloading.last.percent, 100);
    });

    test('總量未知：percent 與 total 為 null，每 256 KB 放行一次', () async {
      const bytes = 1024 * 1024;
      final s = session(_FakeBundleManager(result: _result(), downloadTotal: bytes, reportsTotal: false));
      s.requestBundleDownload(apply: false);
      await _settle();
      final downloading = states.where((st) => st.stage == UpdateStage.downloading).toList();
      // 起始快照 + 約每 256 KB 一次 + 下載結束補發的終值
      expect(downloading.length, 6);
      expect(downloading.skip(1).every((st) => st.percent == null && st.total == null), isTrue);
      expect(downloading.last.received, bytes);
      // 解包總數一定已知，仍有真實百分比
      expect(states.where((st) => st.stage == UpdateStage.extracting).last.percent, 100);
    });

    test('雜湊不符：failed 只廣播一次，不進解包也不套用', () async {
      final s = session(_FakeBundleManager(result: _result(), hashMismatch: true));
      s.requestBundleDownload(apply: true);
      await _settle();
      final stages = stagesOf(UpdateTarget.bundle);
      expect(stages.where((st) => st == UpdateStage.failed).length, 1);
      expect(stages.last, UpdateStage.failed);
      expect(stages, isNot(contains(UpdateStage.extracting)));
      expect(applies, 0);
      expect(s.isBusy, isFalse);
    });

    test('沒有新版時停在 up_to_date', () async {
      final s = session(_FakeBundleManager(result: _result(hasUpdate: false)));
      s.requestBundleDownload(apply: true);
      await _settle();
      expect(stagesOf(UpdateTarget.bundle), [UpdateStage.checking, UpdateStage.upToDate]);
      expect(applies, 0);
    });

    test('殼過舊：廣播 host_too_old 並交給 host 層阻擋', () async {
      const requirement = HostRequirement(minBuildNumber: 9);
      final s = session(_FakeBundleManager(result: _result(hostBlocked: true, host: requirement)));
      s.requestBundleDownload(apply: true);
      await _settle();
      final stages = stagesOf(UpdateTarget.bundle);
      expect(stages.last, UpdateStage.hostTooOld);
      expect(stages.where((st) => st == UpdateStage.hostTooOld).length, 1);
      // 帶殼的 build 號，不是網頁包版本
      expect(states.last.currentVersion, '3');
      expect(states.last.remoteVersion, '9');
      expect(blocked.single, isA<HostTooOldException>());
      expect(applies, 0);
    });

    test('流程進行中第二次指令以 busy 拒絕', () async {
      final s = session(_FakeBundleManager(result: _result()));
      expect(s.requestBundleDownload(apply: false).accepted, isTrue);
      final second = s.requestBundleDownload(apply: false);
      expect(second.accepted, isFalse);
      expect(second.reason, UpdateRejectReason.busy);
      await _settle();
    });

    test('dev 模式一律拒絕', () {
      final s = session(_FakeBundleManager(result: _result()), devMode: true);
      expect(s.requestBundleDownload(apply: true).reason, UpdateRejectReason.dev);
    });
  });

  group('requestBundleApply', () {
    test('有待套用的 next/ 直接套用', () async {
      final s = session(_FakeBundleManager(result: _result(), pending: true));
      expect((await s.requestBundleApply()).accepted, isTrue);
      await _settle();
      expect(stagesOf(UpdateTarget.bundle), [UpdateStage.applying]);
      expect(applies, 1);
    });

    test('沒有待套用時退回一條龍', () async {
      final s = session(_FakeBundleManager(result: _result()));
      await s.requestBundleApply();
      await _settle();
      expect(stagesOf(UpdateTarget.bundle).first, UpdateStage.checking);
      expect(applies, 1);
    });
  });

  group('host update', () {
    test('未查詢過即拒絕', () {
      final s = session(_FakeBundleManager(result: _result()));
      expect(s.requestHostDownload(install: true).reason, UpdateRejectReason.notChecked);
    });

    test('查詢過但伺服器未宣告殼更新即拒絕', () async {
      final s = session(_FakeBundleManager(result: _result(hasUpdate: false)));
      await s.check();
      expect(s.requestHostDownload(install: true).reason, UpdateRejectReason.noHostUpdate);
    });

    test('未下載即安裝以 no_apk 拒絕', () {
      final s = session(_FakeBundleManager(result: _result()));
      expect(s.requestHostInstall().reason, UpdateRejectReason.noApk);
    });
  });
  group('changeEndpoint', () {
    const other = UpdateEndpointOverride(baseUrl: 'https://other.example.com');

    test('dev 模式拒絕', () async {
      final s = session(_FakeBundleManager(result: _result()), devMode: true);
      expect((await s.changeEndpoint(other)).reason, UpdateRejectReason.dev);
    });

    test('更新流程進行中以 busy 拒絕，設定不變', () async {
      final store = UpdateConfigStore(defaults: _config);
      final s = session(_FakeBundleManager(result: _result()), configStore: store);
      s.requestBundleDownload(apply: false);
      expect((await s.changeEndpoint(other)).reason, UpdateRejectReason.busy);
      expect(store.current.baseUrl, _config.baseUrl);
      await _settle();
    });

    test('受理後 session.config 立即是新端點', () async {
      final s = session(_FakeBundleManager(result: _result()));
      expect((await s.changeEndpoint(other)).accepted, isTrue);
      expect(s.config.baseUrl, 'https://other.example.com');
    });

    test('預設未配置（disabled）時仍可設定端點，設定後即啟用', () async {
      final s = session(
        _FakeBundleManager(result: _result()),
        configStore: UpdateConfigStore(defaults: const BundleUpdateConfig(baseUrl: '')),
      );
      expect(s.config.enabled, isFalse);
      expect((await s.changeEndpoint(other)).accepted, isTrue);
      expect(s.config.enabled, isTrue);
    });

    test('換端點後清掉舊伺服器的查詢結果', () async {
      final s = session(_FakeBundleManager(result: _result()));
      await s.check();
      expect(s.lastCheck, isNotNull);
      await s.changeEndpoint(other);
      expect(s.lastCheck, isNull);
      expect(s.requestHostDownload(install: true).reason, UpdateRejectReason.notChecked);
    });

    test('傳 null 清除覆寫並回到預設', () async {
      final s = session(_FakeBundleManager(result: _result()));
      await s.changeEndpoint(other);
      await s.changeEndpoint(null);
      expect(s.config.baseUrl, _config.baseUrl);
    });
  });
}
