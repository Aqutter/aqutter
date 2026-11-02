import 'package:aqutter/src/bridge/bridge_registry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('bridgeDevMode (platform_info.dev)', () {
    test('is true when connected to a dev server or in a debug build', () {
      expect(bridgeDevMode(sessionDevMode: true, debugBuild: false), isTrue);
      expect(bridgeDevMode(sessionDevMode: false, debugBuild: true), isTrue);
      expect(bridgeDevMode(sessionDevMode: true, debugBuild: true), isTrue);
    });

    test('is false for a release build with the bundled web content', () {
      expect(bridgeDevMode(sessionDevMode: false, debugBuild: false), isFalse);
    });
  });

  test('the debug log line names the handler and the platform', () {
    expect(
      unsupportedPluginCallMessage('file-manager.saveToGallery', 'windows'),
      '[aqutter] plugin call skipped: file-manager.saveToGallery is not supported on windows',
    );
  });
}
