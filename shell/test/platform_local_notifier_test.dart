import 'package:aqutter/src/plugins/notification/notification_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(notificationsChannel);
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late List<MethodCall> calls;
  Object? Function(MethodCall call) answer = (_) => null;

  setUp(() {
    calls = [];
    answer = (_) => null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return answer(call);
    });
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('uses the channel name the native code registers', () {
    expect(notificationsChannel, 'com.github.aqutter/notifications');
  });

  test('initialize, show, schedule, cancel and cancelAll map to the native calls', () async {
    final notifier = PlatformLocalNotifier();
    await notifier.initialize((_, _) {});
    await notifier.show(5, 'Hi', 'there', 'p');
    final at = DateTime.utc(2026, 10, 30, 12, 0, 5);
    await notifier.schedule(6, 'Later', '', null, at);
    await notifier.cancel(6);
    await notifier.cancelAll();

    expect(calls.map((c) => c.method), ['initialize', 'show', 'schedule', 'cancel', 'cancelAll']);
    expect(calls[1].arguments, {'id': 5, 'title': 'Hi', 'body': 'there', 'payload': 'p'});
    expect(calls[2].arguments, {'id': 6, 'title': 'Later', 'body': '', 'payload': null, 'atMs': at.millisecondsSinceEpoch});
    expect(calls[3].arguments, {'id': 6});
  });

  test('a tap from the native side reaches the callback, anything else is ignored', () async {
    final taps = <(int, String?)>[];
    await PlatformLocalNotifier().initialize((id, payload) => taps.add((id, payload)));

    Future<void> fromNative(String method, Object? arguments) async {
      await messenger.handlePlatformMessage(
        notificationsChannel,
        const StandardMethodCodec().encodeMethodCall(MethodCall(method, arguments)),
        (_) {},
      );
    }

    await fromNative('tapped', {'id': 3, 'payload': 'open'});
    await fromNative('tapped', {'id': 4, 'payload': null});
    await fromNative('tapped', {'id': 'not an int'});
    await fromNative('other', {'id': 9});

    expect(taps, [(3, 'open'), (4, null)]);
  });

  test('launchedBy reads the native answer, and a missing id means the app was not launched by a notification', () async {
    final notifier = PlatformLocalNotifier();

    answer = (_) => {'id': 8, 'payload': 'deep'};
    final launch = await notifier.launchedBy();
    expect(launch?.id, 8);
    expect(launch?.payload, 'deep');

    answer = (_) => null;
    expect(await notifier.launchedBy(), isNull);
    answer = (_) => {'id': null, 'payload': null};
    expect(await notifier.launchedBy(), isNull);
  });
}
