import 'package:aqutter/aqutter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('handler and event names are namespaced by plugin id', () {
    expect(aqutterPluginHandlerName('haptics', 'impact'), 'haptics.impact');
    expect(aqutterPluginEventChannel('battery', 'changed'), 'battery.changed');
  });

  test('plugin id pattern rejects dots, uppercase and leading digits', () {
    for (final ok in ['haptics', 'native-view', 'a1']) {
      expect(aqutterPluginIdPattern.hasMatch(ok), isTrue, reason: ok);
    }
    for (final bad in ['Haptics', 'a.b', '1a', '', 'a_b']) {
      expect(aqutterPluginIdPattern.hasMatch(bad), isFalse, reason: bad);
    }
  });

  group('supported platforms', () {
    test('a plugin that declares nothing supports every platform', () {
      final plugin = _Plugin(null);
      for (final platform in TargetPlatform.values) {
        expect(aqutterPluginSupports(plugin, platform), isTrue, reason: '$platform');
      }
    });

    test('a plugin that declares platforms supports only those', () {
      final plugin = _Plugin({TargetPlatform.android, TargetPlatform.iOS});
      expect(aqutterPluginSupports(plugin, TargetPlatform.android), isTrue);
      expect(aqutterPluginSupports(plugin, TargetPlatform.iOS), isTrue);
      for (final platform in [TargetPlatform.windows, TargetPlatform.macOS, TargetPlatform.linux, TargetPlatform.fuchsia]) {
        expect(aqutterPluginSupports(plugin, platform), isFalse, reason: '$platform');
      }
    });

    test('an empty set supports no platform', () {
      expect(aqutterPluginSupports(_Plugin(const {}), TargetPlatform.android), isFalse);
    });

    test('the error payload uses the reserved key with a code and a message', () {
      final payload = aqutterErrorPayload(aqutterUnsupportedPlatform, 'maps.moveTo is not supported on linux');
      expect(aqutterErrorKey, 'aqutterError');
      expect(payload, {
        'aqutterError': {'code': 'UNSUPPORTED_PLATFORM', 'message': 'maps.moveTo is not supported on linux'},
      });
    });
  });

  group('aqutterErrorOf', () {
    test('turns an error payload into an AqutterRpcException with its code and message', () {
      final error = aqutterErrorOf(aqutterErrorPayload('DENIED', 'no'));
      expect(error, isA<AqutterRpcException>());
      expect(error!.code, 'DENIED');
      expect(error.message, 'no');
    });

    test('ordinary results and malformed error data are not errors', () {
      for (final result in [null, 'text', 1, <String, dynamic>{'ok': true}, {aqutterErrorKey: 'boom'}, {aqutterErrorKey: {'code': 1, 'message': 'x'}}, {aqutterErrorKey: {'code': 'X'}}]) {
        expect(aqutterErrorOf(result), isNull, reason: '$result');
      }
    });
  });

  test('the host id is reserved', () {
    expect(aqutterReservedPluginId, 'aqutter');
    expect(aqutterPluginIdPattern.hasMatch(aqutterReservedPluginId), isTrue);
  });
}

class _Plugin extends AqutterPlugin {
  _Plugin(this._platforms);

  final Set<TargetPlatform>? _platforms;

  @override
  String get id => 'maps';

  @override
  Set<TargetPlatform>? get supportedPlatforms => _platforms;
}
