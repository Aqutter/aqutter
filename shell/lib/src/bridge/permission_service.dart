import 'package:permission_plus/permission_plus.dart';

import 'permission_mapping.dart';

/// 殼的系統層權限出入口：網頁 bridge 與 plugin 都經由它查詢、要求權限。
///
/// 型別與狀態字串沿用網頁端 `PermissionType` / `PermissionStatus`（`camera`、`location`…；
/// `granted`、`denied`、`permanentlyDenied`…）。不認識的型別一律回 `denied`，不擲例外。
/// 預設實作包住 `permission_plus`；測試與特殊平台可繼承覆寫。
class AqutterPermissions {
  const AqutterPermissions();

  /// 目前的授權狀態，不跳授權視窗。
  Future<String> check(String type) async {
    final permission = mapPermissionType(type);
    if (permission == null) {
      return 'denied';
    }
    return mapPermissionStatus(await PermissionPlus.checkPermission(permission));
  }

  /// 要求授權（必要時跳系統授權視窗），回傳結果狀態。
  Future<String> request(String type) async {
    final permission = mapPermissionType(type);
    if (permission == null) {
      return 'denied';
    }
    return mapPermissionStatus(await PermissionPlus.requestPermission(permission));
  }

  /// 開啟本 App 的系統設定頁（被永久拒絕後只能由使用者在這裡改）。
  Future<void> openSettings() => PermissionPlus.openSettings();
}
