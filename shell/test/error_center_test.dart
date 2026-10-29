import 'dart:io';

import 'package:aqutter/src/bridge/bridge_emitter.dart';
import 'package:aqutter/src/bridge/bridge_names.dart';
import 'package:aqutter/src/error/aqutter_error_reporter.dart';
import 'package:aqutter/src/error/crash_spool.dart';
import 'package:aqutter/src/error/error_center.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

class _FakeEmitter extends BridgeEmitter {
  final List<(String, Object?)> events = [];

  @override
  Future<void> emit(String channel, Object? payload) async {
    events.add((channel, payload));
  }
}

class _Reporter implements AqutterErrorReporter {
  final List<AqutterErrorReport> reports = [];

  @override
  void report(AqutterErrorReport report) => reports.add(report);
}

class _ThrowingReporter implements AqutterErrorReporter {
  @override
  void report(AqutterErrorReport report) => throw StateError('reporter failed');
}

List<Map<String, dynamic>> _reportsOf((String, Object?) event) {
  return ((event.$2 as Map<String, dynamic>)['reports'] as List).cast<Map<String, dynamic>>();
}

void main() {
  late Directory root;
  late CrashSpool spool;
  late _FakeEmitter emitter;
  late _Reporter reporter;
  late ErrorCenter center;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('aqutter_center_test');
    spool = CrashSpool(Directory(p.join(root.path, 'crash_pending')));
    emitter = _FakeEmitter();
    reporter = _Reporter();
    center = ErrorCenter(spool: spool, emitter: emitter, reporters: [_ThrowingReporter(), reporter]);
  });

  tearDown(() async {
    await root.delete(recursive: true);
  });

  test('before the web takes anything an error is spooled and reporters see it, but nothing is emitted', () async {
    await center.recordPlatform(StateError('late'), StackTrace.current);

    expect(await spool.pending(), hasLength(1));
    expect(reporter.reports.single.source, AqutterErrorSource.platform);
    expect(reporter.reports.single.fatal, isTrue);
    expect(emitter.events, isEmpty);
  });

  test('take returns every unacknowledged report oldest first, without emitting', () async {
    await center.recordPlatform(StateError('one'), StackTrace.current);
    await center.recordPlatform(StateError('two'), StackTrace.current);

    final taken = await center.take();

    expect(taken.map((r) => r.message), ['Bad state: one', 'Bad state: two']);
    expect(emitter.events, isEmpty);
  });

  test('after take every new report is pushed immediately, one per event', () async {
    await center.take();

    await center.recordPlatform(StateError('now'), StackTrace.current);
    await center.recordPlatform(StateError('then'), StackTrace.current);

    expect(emitter.events.map((e) => e.$1), [BridgeEvent.crashReports, BridgeEvent.crashReports]);
    expect(_reportsOf(emitter.events.first).single['message'], 'Bad state: now');
    expect(_reportsOf(emitter.events.last).single['message'], 'Bad state: then');
    expect(_reportsOf(emitter.events.first).single['source'], 'platform');
  });

  test('an event dropped because the web was not connected is still returned by the next take', () async {
    await center.take();
    await center.recordPlatform(StateError('lost event'), StackTrace.current);

    final again = await center.take();

    expect(again.map((r) => r.message), ['Bad state: lost event']);
  });

  test('acknowledged reports are not returned again; unacknowledged ones are', () async {
    await center.recordPlatform(StateError('a'), StackTrace.current);
    await center.recordPlatform(StateError('b'), StackTrace.current);
    final first = await center.take();

    await center.ack([first.first.id, 'not-an-id']);

    expect((await center.take()).map((r) => r.id), [first.last.id]);
  });

  test('when everything is acknowledged take returns nothing', () async {
    await center.recordPlatform(StateError('a'), StackTrace.current);
    await center.ack((await center.take()).map((r) => r.id));

    expect(await center.take(), isEmpty);
  });

  test('take returns at most ErrorCenter.maxBatch reports', () async {
    final big = CrashSpool(spool.directory, maxEntries: 200);
    center = ErrorCenter(spool: big, emitter: emitter);
    for (var i = 0; i < ErrorCenter.maxBatch + 5; i++) {
      await big.add(AqutterErrorReport.create(
        source: AqutterErrorSource.flutter,
        fatal: false,
        message: 'e$i',
        now: DateTime.fromMillisecondsSinceEpoch(1000 + i, isUtc: true),
      ));
    }

    expect(await center.take(), hasLength(ErrorCenter.maxBatch));
  });

  test('a report from the web goes to reporters only: not spooled, not emitted', () async {
    await center.take();

    center.reportFromWeb(message: 'js boom', stack: 'at x', fatal: false);

    expect(reporter.reports.single.source, AqutterErrorSource.web);
    expect(reporter.reports.single.message, 'js boom');
    expect(await spool.pending(), isEmpty);
    expect(emitter.events, isEmpty);
  });

  test('a throwing reporter does not stop the others or the spool', () async {
    await center.record(AqutterErrorReport.create(source: AqutterErrorSource.flutter, fatal: false, message: 'x'));

    expect(reporter.reports, hasLength(1));
    expect(await spool.pending(), hasLength(1));
  });

  group('installErrorHooks', () {
    test('routes FlutterError.onError and PlatformDispatcher.onError into the center and restores them', () async {
      final before = FlutterError.onError;
      final beforePlatform = PlatformDispatcher.instance.onError;
      final previousCalls = <FlutterErrorDetails>[];
      FlutterError.onError = previousCalls.add;
      final restore = installErrorHooks(center);
      try {
        FlutterError.onError!(FlutterErrorDetails(exception: StateError('framework'), library: 'widgets'));
        final handled = PlatformDispatcher.instance.onError!(StateError('async'), StackTrace.current);
        await Future<void>.delayed(const Duration(milliseconds: 50));

        expect(previousCalls, hasLength(1));
        expect(handled, isTrue);
        final reports = await spool.pending();
        expect(reports.map((r) => r.source), containsAll([AqutterErrorSource.flutter, AqutterErrorSource.platform]));
        expect(reports.firstWhere((r) => r.source == AqutterErrorSource.flutter).fatal, isFalse);
        expect(reports.firstWhere((r) => r.source == AqutterErrorSource.flutter).extra, {'library': 'widgets'});
      } finally {
        restore();
        FlutterError.onError = before;
        PlatformDispatcher.instance.onError = beforePlatform;
      }
    });
  });

  group('without a spool (crashSpool: false)', () {
    test('errors still reach reporters, but nothing is stored, emitted or returned', () async {
      final bare = ErrorCenter(emitter: emitter, reporters: [reporter]);
      await bare.take();

      await bare.recordPlatform(StateError('no disk'), StackTrace.current);

      expect(reporter.reports.single.message, 'Bad state: no disk');
      expect(emitter.events, isEmpty);
      expect(await bare.take(), isEmpty);
      await bare.ack(['1-aaaaaa']);
      expect(root.listSync().where((e) => p.basename(e.path) == 'crash_pending'), isEmpty);
    });
  });
}
