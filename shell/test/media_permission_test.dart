import 'package:aqutter/src/bridge/media_permission.dart';
import 'package:aqutter_core/aqutter_core.dart';
import 'package:flutter_test/flutter_test.dart';

AqutterPermissionRequest request(String origin, List<AqutterPermissionResourceType> resources) =>
    AqutterPermissionRequest(origin: AqutterWebUri(origin), resources: resources);

void main() {
  final base = Uri.parse('http://127.0.0.1:51234/');

  group('media permission', () {
    test('grants the camera to the bundled web app', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:51234', [AqutterPermissionResourceType.CAMERA]),
        baseUrl: base,
      );
      expect(response.action, AqutterPermissionResponseAction.GRANT);
      expect(response.resources, [AqutterPermissionResourceType.CAMERA]);
    });

    test('grants camera and microphone together', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:51234', [
          AqutterPermissionResourceType.CAMERA,
          AqutterPermissionResourceType.MICROPHONE,
        ]),
        baseUrl: base,
      );
      expect(response.action, AqutterPermissionResponseAction.GRANT);
      expect(response.resources, hasLength(2));
    });

    test('grants to the dev server origin', () {
      final response = decideMediaPermission(
        request('http://localhost:3000', [AqutterPermissionResourceType.CAMERA]),
        baseUrl: base,
        devUrl: 'http://localhost:3000',
      );
      expect(response.action, AqutterPermissionResponseAction.GRANT);
    });

    test('denies an origin the shell does not serve', () {
      final response = decideMediaPermission(
        request('https://example.com', [AqutterPermissionResourceType.CAMERA]),
        baseUrl: base,
      );
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });

    test('denies the same host on another port', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:9999', [AqutterPermissionResourceType.CAMERA]),
        baseUrl: base,
      );
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });

    test('denies the whole request when it asks for anything beyond camera and microphone', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:51234', [
          AqutterPermissionResourceType.CAMERA,
          AqutterPermissionResourceType.PROTECTED_MEDIA_ID,
        ]),
        baseUrl: base,
      );
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });

    test('denies when the web server is not up yet and no dev URL is set', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:51234', [AqutterPermissionResourceType.CAMERA]),
        baseUrl: null,
      );
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });

    test('denies an empty request', () {
      final response = decideMediaPermission(request('http://127.0.0.1:51234', const []), baseUrl: base);
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });

    test('the allowed set can be narrowed by the app', () {
      final response = decideMediaPermission(
        request('http://127.0.0.1:51234', [AqutterPermissionResourceType.MICROPHONE]),
        baseUrl: base,
        allowed: {AqutterPermissionResourceType.CAMERA},
      );
      expect(response.action, AqutterPermissionResponseAction.DENY);
    });
  });
}
