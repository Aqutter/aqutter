import 'dart:io';
import 'dart:math';

import 'package:aqutter/src/error/aqutter_error_reporter.dart';
import 'package:aqutter/src/error/crash_spool.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

AqutterErrorReport _report(int epochMs, {String message = 'boom'}) {
  return AqutterErrorReport.create(
    source: AqutterErrorSource.platform,
    fatal: true,
    message: message,
    now: DateTime.fromMillisecondsSinceEpoch(epochMs, isUtc: true),
    random: Random(epochMs),
  );
}

void main() {
  late Directory root;
  late CrashSpool spool;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('aqutter_spool_test');
    spool = CrashSpool(Directory(p.join(root.path, 'crash_pending')), maxEntries: 3);
  });

  tearDown(() async {
    await root.delete(recursive: true);
  });

  group('AqutterErrorReport', () {
    test('id has the epoch-ms plus 6 hex digits shape and the time is UTC', () {
      final report = _report(1730000000000);
      expect(report.id, matches(RegExp(r'^1730000000000-[0-9a-f]{6}$')));
      expect(report.time.isUtc, isTrue);
      expect(CrashSpool.isValidId(report.id), isTrue);
    });

    test('truncates an over-long message and stack', () {
      final report = AqutterErrorReport.create(
        source: AqutterErrorSource.flutter,
        fatal: false,
        message: 'm' * (AqutterErrorReport.maxMessageLength + 10),
        stack: 's' * (AqutterErrorReport.maxStackLength + 10),
      );
      expect(report.message.length, AqutterErrorReport.maxMessageLength + '…[truncated]'.length);
      expect(report.stack!.endsWith('…[truncated]'), isTrue);
    });

    test('round-trips through json; omits null stack and empty extra', () {
      final report = AqutterErrorReport.create(
        source: AqutterErrorSource.flutter,
        fatal: false,
        message: 'x',
        extra: {'library': 'widgets'},
      );
      final json = report.toJson();
      expect(json.containsKey('stack'), isFalse);
      final back = AqutterErrorReport.fromJson(json);
      expect(back.id, report.id);
      expect(back.source, AqutterErrorSource.flutter);
      expect(back.extra, {'library': 'widgets'});

      expect(
        AqutterErrorReport.create(source: AqutterErrorSource.flutter, fatal: false, message: 'x', extra: {}).toJson().containsKey('extra'),
        isFalse,
      );
    });
  });

  group('CrashSpool', () {
    test('keeps entries across instances (survives a restart) ordered oldest first', () async {
      await spool.add(_report(2000));
      await spool.add(_report(1000));

      final reopened = CrashSpool(spool.directory);
      final pending = await reopened.pending();
      expect(pending.map((r) => r.time.millisecondsSinceEpoch), [1000, 2000]);
    });

    test('ack deletes only the named entries and ignores unknown or malformed ids', () async {
      final a = _report(1000);
      final b = _report(2000);
      await spool.add(a);
      await spool.add(b);

      await spool.ack([a.id, 'nope', '../../etc/passwd', '999-zzzzzz']);

      expect((await spool.pending()).map((r) => r.id), [b.id]);
    });

    test('drops the oldest entries beyond maxEntries', () async {
      for (var i = 1; i <= 5; i++) {
        await spool.add(_report(i * 1000));
      }
      expect((await spool.pending()).map((r) => r.time.millisecondsSinceEpoch), [3000, 4000, 5000]);
    });

    test('a corrupt file is deleted instead of breaking pending()', () async {
      await spool.add(_report(1000));
      final corrupt = File(p.join(spool.directory.path, '9-aaaaaa.json'));
      await corrupt.writeAsString('{not json');

      expect(await spool.pending(), hasLength(1));
      expect(await corrupt.exists(), isFalse);
    });

    test('pending() on a directory that does not exist yet is empty', () async {
      expect(await CrashSpool(Directory(p.join(root.path, 'missing'))).pending(), isEmpty);
    });

    test('leaves no .tmp file behind after add', () async {
      await spool.add(_report(1000));
      final names = spool.directory.listSync().map((e) => p.basename(e.path)).toList();
      expect(names.where((n) => n.endsWith('.tmp')), isEmpty);
    });
  });
}
