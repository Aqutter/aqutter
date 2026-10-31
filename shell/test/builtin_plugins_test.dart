import 'dart:async';

import 'package:aqutter/aqutter.dart';
import 'package:aqutter/src/plugins/builtin_plugins.dart';
import 'package:aqutter/src/plugins/deeplink/deep_link_service.dart';
import 'package:aqutter/src/plugins/deeplink/deeplink_plugin.dart';
import 'package:aqutter/src/plugins/notification/notification_plugin.dart';
import 'package:aqutter/src/plugins/notification/notification_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// 內建 plugin 的契約 rev 1：方法名稱與支援平台（plan 2610310119 的 Contract §1）。
const _everywhere = {
  'clipboard.read',
  'clipboard.write',
  'share.open',
};
const _imagePlatforms = {
  'clipboard.readImage',
  'clipboard.writeImage',
};
const _notifyAndLinks = {
  'notification.show',
  'notification.schedule',
  'notification.cancel',
  'notification.initial',
  'deeplink.initial',
};

Set<String> _capabilities(List<AqutterPlugin> plugins, TargetPlatform platform) {
  return {
    for (final plugin in plugins)
      for (final method in plugin.handlers.keys)
        if (aqutterPluginSupportsMethod(plugin, method, platform)) aqutterPluginHandlerName(plugin.id, method),
  };
}

void main() {
  final plugins = builtinPlugins(permissions: const AqutterPermissions());

  group('built-in plugin names', () {
    test('ids are the reserved built-in ids, valid and unique', () {
      final ids = plugins.map((plugin) => plugin.id).toList();
      expect(ids, builtinPluginIds);
      expect(ids.toSet().length, ids.length);
      for (final id in ids) {
        expect(aqutterPluginIdPattern.hasMatch(id), isTrue, reason: id);
        expect(id, isNot(aqutterReservedPluginId));
      }
    });

    test('the methods are exactly the ones in the contract', () {
      final all = {
        for (final plugin in plugins)
          for (final method in plugin.handlers.keys) aqutterPluginHandlerName(plugin.id, method),
      };
      expect(all, {..._everywhere, ..._imagePlatforms, ..._notifyAndLinks});
    });
  });

  group('capabilities per platform', () {
    test('Android, iOS and macOS support everything', () {
      for (final platform in [TargetPlatform.android, TargetPlatform.iOS, TargetPlatform.macOS]) {
        expect(
          _capabilities(plugins, platform),
          {..._everywhere, ..._imagePlatforms, ..._notifyAndLinks},
          reason: '$platform',
        );
      }
    });

    test('Windows has text, share and images but no notifications or deep links', () {
      expect(_capabilities(plugins, TargetPlatform.windows), {..._everywhere, ..._imagePlatforms});
    });

    test('Linux has only text and share', () {
      expect(_capabilities(plugins, TargetPlatform.linux), _everywhere);
    });
  });

  group('notification plugin', () {
    test('attach starts the service once and forwards taps as the tapped event', () async {
      final notifier = _FakeNotifier()..launch = const NotificationLaunch(id: 7, payload: 'p');
      final plugin = NotificationPlugin(
        permissions: const AqutterPermissions(),
        service: NotificationService(notifier: notifier),
      );
      final context = _FakeContext();

      plugin.attach(context);
      final initial = await plugin.handlers['initial']!(const {});
      await plugin.handlers['initial']!(const {});

      expect(notifier.initializeCount, 1);
      expect(initial, {'id': 7, 'payload': 'p'});

      notifier.onTap!(3, 'x');
      expect(context.emitted.map((event) => event.$1), ['tapped']);
      expect(context.emitted.single.$2, {'id': 3, 'payload': 'x'});
    });

    test('initial works before attach and a tap before attach is dropped', () async {
      final notifier = _FakeNotifier();
      final plugin = NotificationPlugin(
        permissions: const AqutterPermissions(),
        service: NotificationService(notifier: notifier),
      );

      expect(await plugin.handlers['initial']!(const {}), {'id': null, 'payload': null});
      notifier.onTap!(1, null);
    });
  });

  group('deeplink plugin', () {
    test('initial returns the launch link and attach forwards later links as received', () async {
      final source = _FakeSource('app://launch');
      final plugin = DeeplinkPlugin(service: DeepLinkService(source: source));
      final context = _FakeContext();

      expect(await plugin.handlers['initial']!(const {}), {'url': 'app://launch'});

      plugin.attach(context);
      await pumpEventQueue();
      source.controller.add('app://launch');
      source.controller.add('app://next');
      await pumpEventQueue();

      expect(context.emitted.map((event) => event.$1), ['received']);
      expect(context.emitted.single.$2, {'url': 'app://next'});
      plugin.dispose();
    });

    test('dispose without ever using the service does not create it', () {
      DeeplinkPlugin().dispose();
    });
  });
}

class _FakeContext implements AqutterPluginContext {
  final List<(String, Object?)> emitted = [];

  @override
  Future<void> emit(String event, Object? payload) async => emitted.add((event, payload));

  @override
  Future<String> checkPermission(String type) async => 'granted';

  @override
  Future<String> requestPermission(String type) async => 'granted';

  @override
  Future<void> openPermissionSettings() async {}
}

class _FakeNotifier implements LocalNotifier {
  NotificationTapCallback? onTap;
  NotificationLaunch? launch;
  int initializeCount = 0;

  @override
  Future<void> initialize(NotificationTapCallback onTap) async {
    initializeCount += 1;
    this.onTap = onTap;
  }

  @override
  Future<void> show(int id, String title, String body, String? payload) async {}

  @override
  Future<void> schedule(int id, String title, String body, String? payload, DateTime atUtc) async {}

  @override
  Future<void> cancel(int id) async {}

  @override
  Future<void> cancelAll() async {}

  @override
  Future<NotificationLaunch?> launchedBy() async => launch;
}

class _FakeSource implements DeepLinkSource {
  _FakeSource(this.launch);

  final String? launch;
  final StreamController<String> controller = StreamController<String>.broadcast();

  @override
  Future<String?> initialLink() async => launch;

  @override
  Stream<String> get links => controller.stream;
}
