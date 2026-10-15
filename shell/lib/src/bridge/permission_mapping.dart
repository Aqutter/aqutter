import 'package:permission_plus/permission_plus.dart';

/// 網頁端 `PermissionType` 字串 → `permission_plus` 的 [PermissionType]。
///
/// 回傳 null 代表對應不到：呼叫端應視為「沒有這個權限」而不是擲例外，
/// 行為與換套件前（落到 `Permission.unknown`、狀態為 denied）一致。
///
/// 新套件沒有 `bluetoothScan` / `bluetoothConnect` / `calendarFullAccess` 這類細分型別，
/// 且各只有一種合理對應：前兩者併入 [PermissionType.bluetooth]，後者併入 [PermissionType.calendar]。
PermissionType? mapPermissionType(String type) {
  switch (type) {
    case 'camera':
      return PermissionType.camera;
    case 'microphone':
      return PermissionType.microphone;
    case 'location':
    case 'locationWhenInUse':
      return PermissionType.locationWhenInUse;
    case 'locationAlways':
      return PermissionType.locationAlways;
    case 'notifications':
      return PermissionType.notification;
    case 'photos':
      return PermissionType.photos;
    case 'contacts':
      return PermissionType.contacts;
    case 'calendar':
    case 'calendarFullAccess':
      return PermissionType.calendar;
    case 'bluetooth':
    case 'bluetoothScan':
    case 'bluetoothConnect':
      return PermissionType.bluetooth;
    case 'storage':
      return PermissionType.storage;
    case 'phone':
      return PermissionType.phone;
    case 'sms':
      return PermissionType.sms;
    default:
      return null;
  }
}

/// `permission_plus` 的 [PermissionStatus] → 網頁端的狀態字串。
///
/// `provisional`（iOS 臨時通知授權）視為已授權；`notDetermined` 對應網頁端的 `prompt`。
String mapPermissionStatus(PermissionStatus status) {
  switch (status) {
    case PermissionStatus.granted:
    case PermissionStatus.provisional:
      return 'granted';
    case PermissionStatus.permanentlyDenied:
      return 'permanentlyDenied';
    case PermissionStatus.restricted:
      return 'restricted';
    case PermissionStatus.limited:
      return 'limited';
    case PermissionStatus.denied:
      return 'denied';
    case PermissionStatus.notDetermined:
      return 'prompt';
  }
}
