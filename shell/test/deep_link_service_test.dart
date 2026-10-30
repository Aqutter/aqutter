import 'dart:async';

import 'package:aqutter/src/bridge/deep_link_service.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeSource implements DeepLinkSource {
  _FakeSource({this.launch, this.failInitial = false});

  final String? launch;
  final bool failInitial;
  final StreamController<String> controller = StreamController<String>.broadcast();
  int initialCalls = 0;

  @override
  Future<String?> initialLink() async {
    initialCalls += 1;
    if (failInitial) {
      throw StateError('no platform');
    }
    return launch;
  }

  @override
  Stream<String> get links => controller.stream;
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  test('initial returns the launch link and reads the platform only once', () async {
    final source = _FakeSource(launch: 'myapp://open/1');
    final service = DeepLinkService(source: source);

    expect(await service.initial(), 'myapp://open/1');
    expect(await service.initial(), 'myapp://open/1');
    expect(source.initialCalls, 1);
  });

  test('no launch link, or a platform failure, is reported as null', () async {
    expect(await DeepLinkService(source: _FakeSource()).initial(), isNull);
    expect(await DeepLinkService(source: _FakeSource(failInitial: true)).initial(), isNull);
  });

  test('links that arrive while running are forwarded', () async {
    final source = _FakeSource();
    final received = <String>[];
    final service = DeepLinkService(source: source);
    await service.listen(received.add);

    source.controller.add('myapp://a');
    source.controller.add('https://example.com/b');
    await _settle();

    expect(received, ['myapp://a', 'https://example.com/b']);
  });

  test('a stream that repeats the launch link as its first event does not turn it into an event', () async {
    final source = _FakeSource(launch: 'myapp://launch');
    final received = <String>[];
    final service = DeepLinkService(source: source);
    await service.listen(received.add);

    source.controller.add('myapp://launch');
    source.controller.add('myapp://launch');
    await _settle();

    expect(received, ['myapp://launch'], reason: 'only the first repeat is the platform echoing the launch link');
  });

  test('the first event is kept when it differs from the launch link', () async {
    final source = _FakeSource(launch: 'myapp://launch');
    final received = <String>[];
    final service = DeepLinkService(source: source);
    await service.listen(received.add);

    source.controller.add('myapp://other');
    await _settle();

    expect(received, ['myapp://other']);
  });

  test('listen subscribes only once and dispose stops the forwarding', () async {
    final source = _FakeSource();
    final received = <String>[];
    final service = DeepLinkService(source: source);
    await service.listen(received.add);
    await service.listen(received.add);

    source.controller.add('myapp://a');
    await _settle();
    expect(received, ['myapp://a']);

    await service.dispose();
    source.controller.add('myapp://b');
    await _settle();
    expect(received, ['myapp://a']);
  });
}
