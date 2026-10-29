import 'package:aqutter/aqutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AqutterPermissions', () {
    test('an unknown type is denied without touching the platform', () async {
      const permissions = AqutterPermissions();
      expect(await permissions.check('no-such-permission'), 'denied');
      expect(await permissions.request('no-such-permission'), 'denied');
    });
  });

  group('AqutterConfig.webPermissions', () {
    test('defaults to camera and microphone', () {
      expect(const AqutterConfig().webPermissions, isNull);
      expect(defaultWebPermissions, {
        AqutterPermissionResourceType.CAMERA,
        AqutterPermissionResourceType.MICROPHONE,
        AqutterPermissionResourceType.CAMERA_AND_MICROPHONE,
      });
    });
  });
}
