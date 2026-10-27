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

  group('channels', () {
    final host = AqutterNativeHost.instance;
    tearDown(() {
      for (final name in ['maps.bin', 'maps.raw']) {
        host.unregisterChannel(name);
      }
    });

    test('registers each channel as <pluginId>.<channel> on a supported platform', () {
      final plugin = _Plugin(null, channels: {'bin': (_) {}, 'raw': (_) {}});
      aqutterRegisterPluginChannels(host, plugin, TargetPlatform.android);
      expect(aqutterPluginChannelName('maps', 'bin'), 'maps.bin');
      expect(host.hasChannel('maps.bin'), isTrue);
      expect(host.hasChannel('maps.raw'), isTrue);
    });

    test('registers nothing on an unsupported platform', () {
      final plugin = _Plugin({TargetPlatform.android}, channels: {'bin': (_) {}});
      aqutterRegisterPluginChannels(host, plugin, TargetPlatform.iOS);
      expect(host.hasChannel('maps.bin'), isFalse);
    });

    test('a malformed channel name is an assembly-time error', () {
      final plugin = _Plugin(null, channels: {'Bad': (_) {}});
      expect(() => aqutterRegisterPluginChannels(host, plugin, TargetPlatform.android), throwsArgumentError);
    });

    test('unregistering removes the channels', () {
      final plugin = _Plugin(null, channels: {'bin': (_) {}});
      aqutterRegisterPluginChannels(host, plugin, TargetPlatform.android);
      aqutterUnregisterPluginChannels(host, plugin);
      expect(host.hasChannel('maps.bin'), isFalse);
    });
  });
}

class _Plugin extends AqutterPlugin {
  _Plugin(this._platforms, {this.channels = const {}});

  final Set<TargetPlatform>? _platforms;

  @override
  final Map<String, AqutterChannelHandler> channels;

  @override
  String get id => 'maps';

  @override
  Set<TargetPlatform>? get supportedPlatforms => _platforms;
}
