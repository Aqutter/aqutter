import 'package:aqutter/src/plugins/_shared/native_features.dart';
import 'package:aqutter/src/plugins/notification/notification_service.dart';
import 'package:aqutter/src/bridge/permission_service.dart';
import 'package:flutter_test/flutter_test.dart';

class _Permissions extends AqutterPermissions {
  _Permissions(this.status);

  String status;

  @override
  Future<String> check(String type) async => type == 'notifications' ? status : 'denied';
}

class _FakeNotifier implements LocalNotifier {
  final List<String> calls = [];
  NotificationTapCallback? onTap;
  NotificationLaunch? launch;
  int initializeCount = 0;

  @override
  Future<void> initialize(NotificationTapCallback onTap) async {
    initializeCount += 1;
    this.onTap = onTap;
  }

  @override
  Future<void> show(int id, String title, String body, String? payload) async {
    calls.add('show $id $title|$body|$payload');
  }

  @override
  Future<void> schedule(int id, String title, String body, String? payload, DateTime atUtc) async {
    calls.add('schedule $id $title|$body|$payload|${atUtc.toIso8601String()}');
  }

  @override
  Future<void> cancel(int id) async => calls.add('cancel $id');

  @override
  Future<void> cancelAll() async => calls.add('cancelAll');

  @override
  Future<NotificationLaunch?> launchedBy() async => launch;
}

void main() {
  final now = DateTime.utc(2026, 10, 30, 12);
  late _FakeNotifier notifier;
  late _Permissions permissions;
  late NotificationService service;

  setUp(() {
    notifier = _FakeNotifier();
    permissions = _Permissions('granted');
    service = NotificationService(notifier: notifier, permissions: permissions, now: () => now);
  });

  Future<void> expectError(Future<dynamic> call, String code) async {
    await expectLater(call, throwsA(isA<NativeArgumentException>().having((e) => e.code, 'code', code)));
  }

  test('show hands the notification to the platform and returns the id', () async {
    final result = await service.show({'id': 5, 'title': 'Hi', 'body': 'there', 'payload': 'p'});

    expect(result, {'id': 5});
    expect(notifier.calls, ['show 5 Hi|there|p']);
  });

  test('ids are allocated from 1 and never repeat within the process, skipping ids already used explicitly', () async {
    expect((await service.show({'title': 'a'}))['id'], 1);
    await service.show({'title': 'b', 'id': 2});
    expect((await service.show({'title': 'c'}))['id'], 3);
    expect((await service.show({'title': 'd'}))['id'], 4);
  });

  test('showing the same explicit id again just replaces the notification', () async {
    await service.show({'title': 'a', 'id': 9});
    await service.show({'title': 'b', 'id': 9});

    expect(notifier.calls, ['show 9 a||null', 'show 9 b||null']);
  });

  test('schedule uses the absolute time and rejects a time that is not in the future', () async {
    final at = now.add(const Duration(minutes: 10));
    final result = await service.schedule({'title': 'later', 'atMs': at.millisecondsSinceEpoch});

    expect(result, {'id': 1});
    expect(notifier.calls.single, 'schedule 1 later||null|${at.toIso8601String()}');
    await expectError(service.schedule({'title': 'past', 'atMs': now.millisecondsSinceEpoch}), nativeInvalidArgument);
    expect(notifier.calls, hasLength(1));
  });

  test('without the notifications permission nothing is shown and the error is permission_denied', () async {
    permissions.status = 'denied';

    await expectError(service.show({'title': 't'}), nativePermissionDenied);
    await expectError(service.schedule({'title': 't', 'atMs': now.add(const Duration(hours: 1)).millisecondsSinceEpoch}), nativePermissionDenied);
    expect(notifier.calls, isEmpty);
  });

  test('invalid arguments are refused before the permission is even checked', () async {
    permissions.status = 'denied';

    await expectError(service.show({'title': ''}), nativeInvalidArgument);
  });

  test('cancel with an id cancels it; without an id it cancels everything', () async {
    expect(await service.cancel({'id': 4}), {'ok': true});
    expect(await service.cancel({}), {'ok': true});

    expect(notifier.calls, ['cancel 4', 'cancelAll']);
    await expectError(service.cancel({'id': 'x'}), nativeInvalidArgument);
  });

  test('start initializes once and forwards taps', () async {
    final taps = <(int, String?)>[];

    await service.start((id, payload) => taps.add((id, payload)));
    await service.start((id, payload) => fail('the second callback must not replace the first'));
    notifier.onTap!(3, 'open');

    expect(notifier.initializeCount, 1);
    expect(taps, [(3, 'open')]);
  });

  test('initial reports the notification that launched the app, the same on every call', () async {
    expect(service.initial(), {'id': null, 'payload': null});

    notifier.launch = const NotificationLaunch(id: 8, payload: 'deep');
    service = NotificationService(notifier: notifier, permissions: permissions, now: () => now);
    await service.start((_, _) {});

    expect(service.initial(), {'id': 8, 'payload': 'deep'});
    expect(service.initial(), {'id': 8, 'payload': 'deep'});
  });
}
