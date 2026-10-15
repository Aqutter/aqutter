import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/bridge/permission_mapping.dart';
import 'package:permission_plus/permission_plus.dart';

/// 對照表是換套件時最容易寫錯、又最難從 UI 察覺的部分，故以純函式單測鎖住。
void main() {
  group('mapPermissionType', () {
    test('一對一對應', () {
      expect(mapPermissionType('camera'), PermissionType.camera);
      expect(mapPermissionType('microphone'), PermissionType.microphone);
      expect(mapPermissionType('notifications'), PermissionType.notification);
      expect(mapPermissionType('photos'), PermissionType.photos);
      expect(mapPermissionType('contacts'), PermissionType.contacts);
      expect(mapPermissionType('storage'), PermissionType.storage);
      expect(mapPermissionType('phone'), PermissionType.phone);
      expect(mapPermissionType('sms'), PermissionType.sms);
    });

    test('location 與 locationWhenInUse 都是使用中定位，locationAlways 獨立', () {
      expect(mapPermissionType('location'), PermissionType.locationWhenInUse);
      expect(mapPermissionType('locationWhenInUse'), PermissionType.locationWhenInUse);
      expect(mapPermissionType('locationAlways'), PermissionType.locationAlways);
    });

    test('新套件沒有細分型別者併入較粗的型別', () {
      expect(mapPermissionType('bluetoothScan'), PermissionType.bluetooth);
      expect(mapPermissionType('bluetoothConnect'), PermissionType.bluetooth);
      expect(mapPermissionType('calendarFullAccess'), PermissionType.calendar);
    });

    test('對應不到回傳 null，不擲例外', () {
      expect(mapPermissionType('nope'), isNull);
      expect(mapPermissionType(''), isNull);
    });
  });

  group('mapPermissionStatus', () {
    test('覆蓋 permission_plus 的每個狀態', () {
      expect(mapPermissionStatus(PermissionStatus.granted), 'granted');
      expect(mapPermissionStatus(PermissionStatus.provisional), 'granted');
      expect(mapPermissionStatus(PermissionStatus.denied), 'denied');
      expect(mapPermissionStatus(PermissionStatus.permanentlyDenied), 'permanentlyDenied');
      expect(mapPermissionStatus(PermissionStatus.restricted), 'restricted');
      expect(mapPermissionStatus(PermissionStatus.limited), 'limited');
      expect(mapPermissionStatus(PermissionStatus.notDetermined), 'prompt');
    });

    test('對外字串集合與網頁端 PermissionStatus 型別一致', () {
      const webStatuses = {'granted', 'denied', 'prompt', 'restricted', 'limited', 'permanentlyDenied'};
      final mapped = PermissionStatus.values.map(mapPermissionStatus).toSet();
      expect(webStatuses.containsAll(mapped), isTrue);
    });
  });
}
