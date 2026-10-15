import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'bundle_manager.dart';
import 'host_requirement.dart';
import 'host_updater.dart';
import 'update_config.dart';
import 'update_config_store.dart';

/// 更新的對象：網頁包或殼（原生二進位）。
enum UpdateTarget {
  bundle('bundle'),
  host('host');

  const UpdateTarget(this.wireName);

  /// 事件 payload 裡的字面值；對映前端 `UpdateTarget`。
  final String wireName;
}

/// 更新流程的階段；對映前端 `UpdateStage`。
enum UpdateStage {
  checking('checking'),
  upToDate('up_to_date'),
  available('available'),
  hostTooOld('host_too_old'),
  downloading('downloading'),
  verifying('verifying'),
  extracting('extracting'),
  ready('ready'),
  applying('applying'),
  failed('failed');

  const UpdateStage(this.wireName);

  /// 事件 payload 裡的字面值。
  final String wireName;
}

/// 一次狀態快照；經 `update_state` 事件推給網頁端，也餵給原生過場。
class UpdateState {
  const UpdateState({
    required this.target,
    required this.stage,
    this.received,
    this.total,
    this.percent,
    this.done,
    this.extractTotal,
    this.currentVersion,
    this.remoteVersion,
    this.error,
  });

  final UpdateTarget target;
  final UpdateStage stage;

  /// 已下載位元組；僅 [UpdateStage.downloading]。
  final int? received;

  /// 總位元組；未知時為 null。
  final int? total;

  /// 0–100；下載與解包皆用，未知總量時為 null。
  final double? percent;

  /// 已解包項目數；僅 [UpdateStage.extracting]。
  final int? done;

  /// 解包總項目數；僅 [UpdateStage.extracting]。
  final int? extractTotal;

  /// 本機目前版本（網頁包時戳，或殼 build number）。
  final String? currentVersion;

  /// 遠端版本（網頁包時戳，或殼要求的 build number）。
  final String? remoteVersion;

  /// 失敗原因；僅 [UpdateStage.failed]。
  final String? error;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'target': target.wireName,
      'stage': stage.wireName,
      'received': received,
      'total': total,
      'percent': percent,
      'done': done,
      'extractTotal': extractTotal,
      'currentVersion': currentVersion,
      'remoteVersion': remoteVersion,
      'error': error,
    };
  }
}

typedef UpdateStateListener = void Function(UpdateState state);

/// 網頁端指令被拒絕的原因；對映前端 `UpdateRejectReason`。
enum UpdateRejectReason {
  /// dev 模式：載的是 dev server，沒有網頁包可換。
  dev('dev'),

  /// 未配置 `AQUTTER_UPDATE_BASE_URL`。
  disabled('disabled'),

  /// `update_config_set` 的 payload 驗證失敗。
  invalidConfig('invalid_config'),

  /// 已有一條更新流程在跑。
  busy('busy'),

  /// 沒有已下載、待套用的網頁包。
  noPending('no_pending'),

  /// 尚未查詢過版本，不知道殼要更新到哪裡。
  notChecked('not_checked'),

  /// 伺服器未宣告殼更新，或管道不是 App 內 APK。
  noHostUpdate('no_host_update'),

  /// 尚未下載 APK。
  noApk('no_apk');

  const UpdateRejectReason(this.wireName);

  /// 回應 JSON 裡的字面值。
  final String wireName;
}

/// 網頁端指令的受理結果：受理即代表流程已在背景開跑，之後只以事件回報。
class UpdateAcceptance {
  const UpdateAcceptance.accepted()
    : accepted = true,
      reason = null;

  const UpdateAcceptance.rejected(this.reason) : accepted = false;

  final bool accepted;
  final UpdateRejectReason? reason;

  Map<String, dynamic> toJson() => {'accepted': accepted, 'reason': reason?.wireName};
}

/// 下載／解包進度的節流：整數百分比變動才放行；總量未知時每 256 KB 放行一次。
///
/// 回呼很密集（下載逐 chunk、解包逐檔），逐次 `setState` 與 `evaluateJavascript`
/// 都會拖慢流程本身，而人眼也看不出 0.3% 的差別。
class _ProgressThrottle {
  static const int _unknownTotalStep = 256 * 1024;

  int _lastPercent = -1;
  int _lastValue = -_unknownTotalStep;

  /// 最後一次被略過的值；null 表示最新的值已放行過。
  int? _skipped;

  /// [value] / [total] 過閘時回傳百分比（總量未知回 null），否則回 false 代表略過。
  ({bool pass, double? percent}) admit(int value, int total) {
    final gate = _admit(value, total);
    _skipped = gate.pass ? null : value;
    return gate;
  }

  /// 取出最後一次被略過的值並清空；階段結束時補發，確保終值一定送達。
  ///
  /// 總量未知時節流只看「距上次放行多少」，最後一段不足一步的尾巴永遠過不了閘——
  /// 不補發的話網頁端看到的已下載量會停在終值之前，下一個事件卻已是解包。
  int? takeSkipped() {
    final skipped = _skipped;
    _skipped = null;
    return skipped;
  }

  ({bool pass, double? percent}) _admit(int value, int total) {
    if (total <= 0) {
      if (value - _lastValue < _unknownTotalStep) {
        return (pass: false, percent: null);
      }
      _lastValue = value;
      return (pass: true, percent: null);
    }
    final percent = (value * 100) ~/ total;
    if (percent == _lastPercent) {
      return (pass: false, percent: null);
    }
    _lastPercent = percent;
    return (pass: true, percent: (value / total * 100).clamp(0, 100).toDouble());
  }
}

/// 更新流程的單一狀態機：串接查版本 → 下載 → 解包 → 套用（或 APK 下載 → 安裝），
/// 每個階段以 [UpdateState] 廣播給 [onState]。
///
/// 廣播的接收端有兩個——原生過場（WebView 不在時）與 `update_state` bridge 事件
/// （WebView 在時）——兩者都由 host 層在 [onState] 內分派，本類別不認識任何畫面。
///
/// 同時只允許一條流程：網頁端連按兩次、或冷啟檢查中又收到網頁端指令，第二條一律
/// 以 [UpdateRejectReason.busy] 拒絕，而非排隊——排隊的那條跑起來時前提可能已不成立。
class UpdateSession {
  UpdateSession({
    required this.bundle,
    required this.hostUpdater,
    required this.configStore,
    required this.devMode,
    required this.onState,
    required this.onApplyBundle,
    required this.onHostTooOld,
    required this.onCheckFailed,
  });

  final BundleManager bundle;
  final HostUpdater hostUpdater;
  final UpdateConfigStore configStore;

  /// 目前生效的版更設定；網頁端切換伺服器後會變，每次使用時都重新取。
  BundleUpdateConfig get config => configStore.current;

  /// 載的是 dev server 時為 true：沒有網頁包可換，所有指令一律拒絕。
  final bool devMode;

  final UpdateStateListener onState;

  /// 套用已下載網頁包的實際動作（卸 WebView → `applyPending` → 重掛），由 host 層提供——
  /// 那一段牽涉畫面與 server 生命週期，不屬於本類別。
  final Future<void> Function() onApplyBundle;

  /// 要下載／套用時發現殼過舊；host 層據此切到阻擋畫面（純查詢不會觸發）。
  final void Function(HostTooOldException error) onHostTooOld;

  /// 嚴格模式下查詢或下載失敗；host 層據此切到「無法確認版本」阻擋畫面。
  final void Function(UpdateCheckFailedException error) onCheckFailed;

  UpdateCheckResult? _lastCheck;
  File? _apk;
  bool _busy = false;

  /// 最後一次廣播的狀態；用來避免同一個失敗被廣播兩次。
  UpdateState? _lastState;

  /// 是否有流程在跑。
  bool get isBusy => _busy;

  /// 上一次成功的查詢結果；殼更新的 URL 與型別從這裡取。
  UpdateCheckResult? get lastCheck => _lastCheck;

  // ---- 冷啟與 host 層直接呼叫的分段 API ----

  /// 查詢版本並廣播結果；失敗時廣播 [UpdateStage.failed] 後重拋，交由呼叫端分流。
  ///
  /// 殼過舊在此只是 [UpdateStage.hostTooOld] 這個**事實**，不呼叫 [onHostTooOld]——
  /// 網頁端查詢時要的是能自行顯示的資料，阻擋只發生在要下載／套用的那條路徑。
  Future<UpdateCheckResult> check() async {
    _emit(const UpdateState(target: UpdateTarget.bundle, stage: UpdateStage.checking));
    try {
      final result = await bundle.check(config);
      _lastCheck = result;
      _emit(_checkState(result));
      return result;
    }
    catch (e) {
      _emit(UpdateState(target: UpdateTarget.bundle, stage: UpdateStage.failed, error: '$e'));
      rethrow;
    }
  }

  /// 下載並解包 [result] 指向的網頁包到 `next/`；[apply] 為 true 時接著呼叫 [onApplyBundle]。
  ///
  /// 失敗時廣播 [UpdateStage.failed] 後重拋。殼過舊直接拋 [HostTooOldException]，
  /// 呼叫端決定要不要阻擋。
  Future<void> downloadBundle(UpdateCheckResult result, {required bool apply}) async {
    if (result.hostBlocked) {
      throw result.hostTooOld;
    }
    final remote = result.remote;
    final versions = (current: result.localVersion, remote: remote.version);
    try {
      final downloadThrottle = _ProgressThrottle();
      final extractThrottle = _ProgressThrottle();
      int? lastTotal;
      void flushDownload() {
        final received = downloadThrottle.takeSkipped();
        if (received != null) {
          _emit(_bundleState(UpdateStage.downloading, versions, received: received, total: lastTotal));
        }
      }
      _emit(_bundleState(UpdateStage.downloading, versions, received: 0, total: remote.size));
      await bundle.download(
        config,
        remote,
        onProgress: (received, total) {
          lastTotal = total > 0 ? total : null;
          final gate = downloadThrottle.admit(received, total);
          if (!gate.pass) {
            return;
          }
          _emit(_bundleState(
            UpdateStage.downloading,
            versions,
            received: received,
            total: lastTotal,
            percent: gate.percent,
          ));
        },
        onVerifying: () {
          // 先補發下載終值，事件順序才不會倒置
          flushDownload();
          _emit(_bundleState(UpdateStage.verifying, versions));
        },
        onExtractProgress: (done, total) {
          final gate = extractThrottle.admit(done, total);
          if (!gate.pass) {
            return;
          }
          _emit(_bundleState(
            UpdateStage.extracting,
            versions,
            done: done,
            extractTotal: total,
            percent: gate.percent,
          ));
        },
      );
      flushDownload();
      _emit(_bundleState(UpdateStage.ready, versions));
    }
    catch (e) {
      _emit(_bundleState(UpdateStage.failed, versions, error: '$e'));
      rethrow;
    }
    if (apply) {
      await applyBundle(versions);
    }
  }

  /// 廣播 [UpdateStage.applying] 並交給 host 層換包。
  Future<void> applyBundle(({String? current, String remote})? versions) async {
    _emit(_bundleState(UpdateStage.applying, versions));
    await onApplyBundle();
  }

  // ---- 網頁端指令：同步回報受理，流程在背景跑 ----

  /// `bundle_download_update`：查版本 → 有新版就下載，[apply] 為 true 時接著套用。
  ///
  /// 每次都重新查詢而非沿用 [lastCheck]：多一次請求換來的是「下載的一定是伺服器
  /// 此刻要給的那一版」，且殼閘也在此刻重新判定。
  UpdateAcceptance requestBundleDownload({required bool apply}) {
    final rejection = _rejectIfUnavailable();
    if (rejection != null) {
      return rejection;
    }
    _runInBackground(UpdateTarget.bundle, () async {
      final result = await check();
      if (!result.hasUpdate) {
        return;
      }
      await downloadBundle(result, apply: apply);
    });
    return const UpdateAcceptance.accepted();
  }

  /// `bundle_apply_update`：有待套用的 `next/` 就直接套用；沒有則退回一條龍
  /// （＝ [requestBundleDownload] 且 `apply:true`），讓改版前的網頁呼叫維持原意。
  Future<UpdateAcceptance> requestBundleApply() async {
    final rejection = _rejectIfUnavailable();
    if (rejection != null) {
      return rejection;
    }
    if (!await bundle.hasPending()) {
      return requestBundleDownload(apply: true);
    }
    _runInBackground(UpdateTarget.bundle, () => applyBundle(null));
    return const UpdateAcceptance.accepted();
  }

  /// `host_download_update`：依上次查詢的 `host` 區塊下載 APK；[install] 為 true 時接著安裝。
  ///
  /// 需要先查詢過（[lastCheck]）且管道為 App 內 APK；其餘型別（外部連結）沒有
  /// 「下載」可言，網頁端應改開 `updateUrl`。
  UpdateAcceptance requestHostDownload({required bool install}) {
    final rejection = _rejectIfUnavailable();
    if (rejection != null) {
      return rejection;
    }
    final result = _lastCheck;
    if (result == null) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.notChecked);
    }
    final requirement = result.remote.host;
    if (requirement == null || requirement.updateUrl == null || !HostUpdater.usesApk(requirement)) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.noHostUpdate);
    }
    _runInBackground(UpdateTarget.host, () async {
      await _downloadHost(requirement, result);
      if (install) {
        await _installHost();
      }
    });
    return const UpdateAcceptance.accepted();
  }

  /// `host_install_update`：安裝已下載並驗過的 APK。
  UpdateAcceptance requestHostInstall() {
    final rejection = _rejectIfUnavailable();
    if (rejection != null) {
      return rejection;
    }
    if (_apk == null) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.noApk);
    }
    _runInBackground(UpdateTarget.host, _installHost);
    return const UpdateAcceptance.accepted();
  }

  /// `update_config_set` / `update_config_reset`：切換版更伺服器；[value] 為 null 即清除覆寫。
  ///
  /// 與更新流程互斥——下載到一半換端點，會讓下載與驗證落在不同伺服器，故忙碌時拒絕。
  /// 不看 [UpdateConfigStore.current] 的 `enabled`：預設未配置的 App 正是靠這條才能啟用。
  /// 換端點後清掉上次查詢結果與已下載的 APK，它們都屬於舊伺服器，不得被新伺服器的流程沿用。
  Future<UpdateAcceptance> changeEndpoint(UpdateEndpointOverride? value) async {
    if (devMode) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.dev);
    }
    if (_busy) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.busy);
    }
    _busy = true;
    try {
      if (value == null) {
        await configStore.clearOverride();
      }
      else {
        await configStore.setOverride(value);
      }
      _lastCheck = null;
      _apk = null;
      return const UpdateAcceptance.accepted();
    }
    finally {
      _busy = false;
    }
  }

  Future<void> _downloadHost(HostRequirement requirement, UpdateCheckResult result) async {
    final versions = (
      current: result.host.buildNumberRaw,
      remote: requirement.minBuildNumber?.toString() ?? '',
    );
    final throttle = _ProgressThrottle();
    int? lastTotal;
    _emit(_hostState(UpdateStage.downloading, versions, received: 0, total: requirement.updateSize));
    _apk = await hostUpdater.download(
      requirement,
      onProgress: (received, total) {
        lastTotal = total > 0 ? total : null;
        final gate = throttle.admit(received, total);
        if (!gate.pass) {
          return;
        }
        _emit(_hostState(
          UpdateStage.downloading,
          versions,
          received: received,
          total: lastTotal,
          percent: gate.percent,
        ));
      },
      onVerifying: () {
        final tail = throttle.takeSkipped();
        if (tail != null) {
          _emit(_hostState(UpdateStage.downloading, versions, received: tail, total: lastTotal));
        }
        _emit(_hostState(UpdateStage.verifying, versions));
      },
    );
    _emit(_hostState(UpdateStage.ready, versions));
  }

  Future<void> _installHost() async {
    final apk = _apk;
    if (apk == null) {
      throw StateError('APK has not been downloaded');
    }
    _emit(const UpdateState(target: UpdateTarget.host, stage: UpdateStage.applying));
    await hostUpdater.install(apk);
  }

  UpdateAcceptance? _rejectIfUnavailable() {
    if (devMode) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.dev);
    }
    if (!config.enabled) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.disabled);
    }
    if (_busy) {
      return const UpdateAcceptance.rejected(UpdateRejectReason.busy);
    }
    return null;
  }

  /// 背景執行一條流程並收斂所有失敗：阻擋類例外轉交 host 層切畫面，其餘只以
  /// [UpdateStage.failed] 事件回報——網頁還活著，讓它自己顯示。
  void _runInBackground(UpdateTarget target, Future<void> Function() body) {
    _busy = true;
    unawaited(() async {
      try {
        await body();
      }
      on HostTooOldException catch (e) {
        // 經 check() 進來的已廣播過 host_too_old；只有沒經過查詢的路徑才需要在此補發
        if (_lastState?.stage != UpdateStage.hostTooOld) {
          _emit(_hostTooOldState(e.host.buildNumberRaw, e.requirement.minBuildNumber));
        }
        onHostTooOld(e);
      }
      on UpdateCheckFailedException catch (e) {
        onCheckFailed(e);
      }
      catch (e) {
        debugPrint('[UpdateSession] $target update failed: $e');
        // check / downloadBundle 已先廣播過 failed 再重拋；這裡只補它們之外的失敗（套用、
        // 殼下載、安裝），否則網頁端會收到同一個失敗兩次
        if (_lastState?.stage != UpdateStage.failed) {
          _emit(UpdateState(target: target, stage: UpdateStage.failed, error: '$e'));
        }
      }
      finally {
        _busy = false;
      }
    }());
  }

  /// 冷啟等由 host 層自行編排的流程，也要佔住 [isBusy]，否則網頁一掛上就能插一條進來。
  Future<T> runExclusive<T>(Future<T> Function() body) async {
    _busy = true;
    try {
      return await body();
    }
    finally {
      _busy = false;
    }
  }

  void _emit(UpdateState state) {
    _lastState = state;
    onState(state);
  }

  /// 殼過舊的狀態一律帶**殼**的版本（本機 build 與要求的最低 build），不帶網頁包版本——
  /// 網頁端看到這個階段要顯示的是「App 要更新到哪一版」。
  UpdateState _hostTooOldState(String currentBuild, int? requiredBuild) {
    return UpdateState(
      target: UpdateTarget.bundle,
      stage: UpdateStage.hostTooOld,
      currentVersion: currentBuild,
      remoteVersion: requiredBuild?.toString(),
    );
  }

  UpdateState _checkState(UpdateCheckResult result) {
    if (result.hostBlocked) {
      return _hostTooOldState(result.host.buildNumberRaw, result.remote.host?.minBuildNumber);
    }
    final stage = result.hasUpdate ? UpdateStage.available : UpdateStage.upToDate;
    return UpdateState(
      target: UpdateTarget.bundle,
      stage: stage,
      total: result.remote.size,
      currentVersion: result.localVersion,
      remoteVersion: result.remote.version,
    );
  }

  UpdateState _bundleState(
    UpdateStage stage,
    ({String? current, String remote})? versions, {
    int? received,
    int? total,
    double? percent,
    int? done,
    int? extractTotal,
    String? error,
  }) {
    return UpdateState(
      target: UpdateTarget.bundle,
      stage: stage,
      received: received,
      total: total,
      percent: percent,
      done: done,
      extractTotal: extractTotal,
      currentVersion: versions?.current,
      remoteVersion: versions?.remote,
      error: error,
    );
  }

  UpdateState _hostState(
    UpdateStage stage,
    ({String current, String remote}) versions, {
    int? received,
    int? total,
    double? percent,
  }) {
    return UpdateState(
      target: UpdateTarget.host,
      stage: stage,
      received: received,
      total: total,
      percent: percent,
      currentVersion: versions.current,
      remoteVersion: versions.remote,
    );
  }
}
