/// 橋接名稱常數。BridgeHandler / BridgeEvent 對映前端 `Aqutter/aqutter-js` 的 `src/contract/bridge.ts`；
/// HostMethod 對映 Android `MainActivity.kt`。凡「兩端必須一致」的名稱一律集中於此，
/// 避免魔法字串散落。
library;

/// JS→原生 handler 名稱。
class BridgeHandler {
  const BridgeHandler._();

  static const String platformInfo = 'platform_info';

  /// 網頁層已掛載且首次繪製完成；host 據此移除啟動過場。
  static const String appReady = 'app_ready';


  static const String storeGet = 'store_get';
  static const String storeSet = 'store_set';

  static const String download = 'download';

  static const String logList = 'log_list';
  static const String logRead = 'log_read';
  static const String logWrite = 'log_write';
  static const String logRemove = 'log_remove';
  static const String logDir = 'log_dir';
  static const String logAppend = 'log_append';
  static const String logSetKey = 'log_set_key';

  /// 網頁確認已把 crash 紀錄寫入目標檔案，殼刪除對應的待送紀錄；請求 `{'ids': [...]}`。
  static const String crashAck = 'crash_ack';

  /// 網頁的未捕捉錯誤，派給 [AqutterErrorReporter]（不寫檔）；請求 `{'message', 'stack'?, 'fatal'}`。
  static const String errorReport = 'error_report';

  static const String deviceId = 'device_id';
  static const String deviceInfo = 'device_info';
  static const String deviceBattery = 'device_battery';
  static const String deviceNetwork = 'device_network';
  static const String deviceLocale = 'device_locale';

  static const String permCheck = 'perm_check';
  static const String permRequest = 'perm_request';
  static const String permOpenSettings = 'perm_open_settings';

  static const String openerOpen = 'opener_open';

  static const String iabOpen = 'iab_open';
  static const String iabClose = 'iab_close';

  static const String pickerPick = 'picker_pick';

  static const String httpFetch = 'http_fetch';
  static const String httpAbort = 'http_abort';

  static const String bundleInfo = 'bundle_info';

  /// 查版本；純查詢，不下載、不動畫面。
  static const String bundleCheckUpdate = 'bundle_check_update';

  /// 讀取目前生效的版更端點（不含 API KEY 值）與編譯期預設。
  static const String updateConfigGet = 'update_config_get';

  /// 設定版更端點覆寫（切換版更伺服器）；持久化、冷啟沿用。
  static const String updateConfigSet = 'update_config_set';

  /// 清除覆寫，回到編譯期預設。
  static const String updateConfigReset = 'update_config_reset';

  /// 背景下載並解包網頁包到 `next/`；`apply`（預設 true）為 true 時下載完直接套用。
  static const String bundleDownloadUpdate = 'bundle_download_update';

  /// 套用已下載的 `next/`；沒有待套用的網頁包時退回「查版本→下載→套用」一條龍。
  static const String bundleApplyUpdate = 'bundle_apply_update';

  /// 背景下載殼的 APK；`install`（預設 true）為 true 時下載完直接喚起安裝器。
  static const String hostDownloadUpdate = 'host_download_update';

  /// 安裝已下載的 APK。
  static const String hostInstallUpdate = 'host_install_update';

  static const String tcpConnect = 'tcp_connect';
  static const String tcpDisconnect = 'tcp_disconnect';
  static const String tcpSend = 'tcp_send';
  static const String tcpRead = 'tcp_read';
  static const String tcpDiagnose = 'tcp_diagnose';

  static const String orientationLock = 'orientation_lock';
  static const String orientationUnlock = 'orientation_unlock';

  static const String statusBarShow = 'statusbar_show';
  static const String statusBarHide = 'statusbar_hide';
  static const String statusBarImmersive = 'statusbar_immersive';

  static const String themeSet = 'theme_set';

  static const String minimizeApp = 'minimize_app';
}

/// Dart→原生宿主的 MethodChannel 名稱與方法，對映 `android/app/src/main/kotlin/.../MainActivity.kt`。
/// 未佈線的平台（iOS / 桌面）呼叫會拋 MissingPluginException，由呼叫端自行處理。
class HostMethod {
  const HostMethod._();

  static const String channel = 'app/host';

  /// 最小化 App（Android `moveTaskToBack`）。
  static const String minimize = 'minimize';

  /// 隱藏系統列（狀態列 + 導航列），維持 edge-to-edge。
  static const String systemBarsHide = 'system_bars_hide';

  /// 顯示系統列，維持 edge-to-edge。
  static const String systemBarsShow = 'system_bars_show';

  /// 喚起系統安裝器安裝已下載的 APK（Android 限定），參數為 `{'path': <絕對路徑>}`。
  static const String installApk = 'install_apk';

  /// 原生→Dart（反向）：攔到功能鍵，參數為 `{'key': <AppKey>}`，原生層已正規化。
  static const String hardwareKey = 'hardware_key';
}

/// 原生→JS 事件頻道名稱。
class BridgeEvent {
  const BridgeEvent._();

  static const String battery = 'broadcast_battery';
  static const String network = 'broadcast_network';
  static const String action = 'broadcast_action';
  static const String androidBack = 'flutter-android-back';

  /// 原生攔到的功能鍵，payload `{'key': <AppKey>}`；網頁層由 appKey plugin 統一派送。
  static const String hardwareKey = 'flutter-hardware-key';
  static const String downloadProgress = 'download_progress';

  /// 更新流程（網頁包／殼）的每個狀態；payload 見 `UpdateState.toJson`。
  static const String updateState = 'update_state';

  /// 殼端尚未被確認的 crash／錯誤紀錄，payload `{'reports': [...]}`（見 `AqutterErrorReport.toJson`）。
  static const String crashReports = 'crash_reports';
}
