import 'dart:async';

import 'package:aqutter/src/plugins/deeplink/deep_link_options.dart';
import 'package:aqutter/src/plugins/deeplink/deep_link_service.dart';
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

  group('DeepLinkOptions', () {
    test('without options every link passes unchanged', () {
      expect(const DeepLinkOptions().apply('anything://x/y'), 'anything://x/y');
    });

    test('allowedSchemes and allowedHosts are case-insensitive and both must match', () {
      const options = DeepLinkOptions(allowedSchemes: {'HTTPS'}, allowedHosts: {'Example.com'});

      expect(options.apply('https://example.com/a'), 'https://example.com/a');
      expect(options.apply('http://example.com/a'), isNull);
      expect(options.apply('https://other.com/a'), isNull);
    });

    test('allowedHosts drops links that have no host', () {
      expect(const DeepLinkOptions(allowedHosts: {'open'}).apply('myapp:///open/1'), isNull);
    });

    test('transform rewrites the link, and null or a throw drops it', () {
      final rewrite = DeepLinkOptions(transform: (url) => url.replaceFirst('myapp://', '/'));
      expect(rewrite.apply('myapp://open/1'), '/open/1');
      expect(DeepLinkOptions(transform: (_) => null).apply('myapp://x'), isNull);
      expect(DeepLinkOptions(transform: (_) => throw StateError('bad')).apply('myapp://x'), isNull);
    });

    test('transform only sees links that passed the allow lists', () {
      var calls = 0;
      final options = DeepLinkOptions(allowedSchemes: {'myapp'}, transform: (url) {
        calls += 1;
        return url;
      });

      options.apply('evil://x');
      expect(calls, 0);
    });
  });

  group('DeepLinkService with options', () {
    const options = DeepLinkOptions(allowedSchemes: {'myapp'});

    test('initial applies the options; a rejected launch link becomes null', () async {
      expect(await DeepLinkService(source: _FakeSource(launch: 'myapp://a'), options: options).initial(), 'myapp://a');
      expect(await DeepLinkService(source: _FakeSource(launch: 'evil://a'), options: options).initial(), isNull);
    });

    test('running links are filtered and transformed', () async {
      final source = _FakeSource();
      final received = <String>[];
      final service = DeepLinkService(
        source: source,
        options: DeepLinkOptions(allowedSchemes: {'myapp'}, transform: (url) => url.toUpperCase()),
      );
      await service.listen(received.add);

      source.controller.add('evil://x');
      source.controller.add('myapp://a');
      await _settle();

      expect(received, ['MYAPP://A']);
    });

    test('the launch link repeated by the stream is still filtered out when it is transformed', () async {
      final source = _FakeSource(launch: 'myapp://launch');
      final received = <String>[];
      final service = DeepLinkService(source: source, options: DeepLinkOptions(transform: (url) => '/x'));
      await service.listen(received.add);

      source.controller.add('myapp://launch');
      source.controller.add('myapp://next');
      await _settle();

      expect(await service.initial(), '/x');
      expect(received, ['/x']);
    });
  });
}
