import 'dart:io';

import 'package:aqutter/src/bridge/log_retention.dart';
import 'package:aqutter/src/bridge/log_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

LogFileStat _file(String name, int size, DateTime modified) => LogFileStat(path: name, size: size, modified: modified);

void main() {
  final now = DateTime(2026, 10, 29, 12);

  group('selectLogFilesToDelete', () {
    test('deletes files older than maxAge and keeps the rest', () {
      final doomed = selectLogFilesToDelete(
        [
          _file('old', 10, now.subtract(const Duration(days: 15))),
          _file('edge', 10, now.subtract(const Duration(days: 13))),
          _file('new', 10, now.subtract(const Duration(days: 1))),
        ],
        retention: const LogRetention(maxAge: Duration(days: 14), maxBytes: null),
        now: now,
      );
      expect(doomed, ['old']);
    });

    test('over maxBytes deletes the oldest first until the total fits', () {
      final doomed = selectLogFilesToDelete(
        [
          _file('c', 40, now.subtract(const Duration(days: 1))),
          _file('a', 40, now.subtract(const Duration(days: 3))),
          _file('b', 40, now.subtract(const Duration(days: 2))),
        ],
        retention: const LogRetention(maxAge: null, maxBytes: 70),
        now: now,
      );
      expect(doomed, ['a', 'b']);
    });

    test('a file modified today is never deleted, even when it alone exceeds the cap', () {
      final doomed = selectLogFilesToDelete(
        [
          _file('today', 500, DateTime(2026, 10, 29, 1)),
          _file('yesterday', 10, DateTime(2026, 10, 28, 23)),
        ],
        retention: const LogRetention(maxAge: Duration(days: 0), maxBytes: 100),
        now: now,
      );
      expect(doomed, ['yesterday']);
    });

    test('unlimited and null limits delete nothing', () {
      final files = [_file('ancient', 1 << 30, DateTime(2000))];
      expect(selectLogFilesToDelete(files, retention: LogRetention.unlimited, now: now), isEmpty);
    });

    test('defaults are 14 days and 20 MiB', () {
      const retention = LogRetention();
      expect(retention.maxAge, const Duration(days: 14));
      expect(retention.maxBytes, 20 * 1024 * 1024);
    });

    test('a file counted as expired is not counted again against the byte cap', () {
      final doomed = selectLogFilesToDelete(
        [
          _file('expired', 100, now.subtract(const Duration(days: 30))),
          _file('a', 60, now.subtract(const Duration(days: 2))),
          _file('b', 60, now.subtract(const Duration(days: 1))),
        ],
        retention: const LogRetention(maxAge: Duration(days: 14), maxBytes: 130),
        now: now,
      );
      expect(doomed, ['expired']);
    });
  });

  group('LogService.prune on the default log directory', () {
    late Directory root;
    late DateTime clock;

    setUp(() async {
      root = await Directory.systemTemp.createTemp('aqutter_retention_test');
      clock = DateTime(2026, 10, 29, 12);
    });

    tearDown(() async {
      await root.delete(recursive: true);
    });

    LogService serviceWith(LogRetention retention) {
      return LogService(
        rootResolver: (provider) async => Directory(p.join(root.path, provider.name)),
        now: () => clock,
        retention: retention,
      );
    }

    Future<File> seed(String relative, DateTime modified, {int size = 10}) async {
      final file = File(p.join(root.path, relative));
      await file.create(recursive: true);
      await file.writeAsString('x' * size);
      await file.setLastModified(modified);
      return file;
    }

    test('removes expired files in the default directory only', () async {
      final expired = await seed('internal/logs/app_20260101.log', DateTime(2026, 1, 1));
      final recent = await seed('internal/logs/app_20261028.log', DateTime(2026, 10, 28));
      final custom = await seed('external/sync/order_20260101.log', DateTime(2026, 1, 1));
      final notLog = await seed('internal/logs/keep.txt', DateTime(2026, 1, 1));

      await serviceWith(const LogRetention(maxAge: Duration(days: 14), maxBytes: null)).prune();

      expect(await expired.exists(), isFalse);
      expect(await recent.exists(), isTrue);
      expect(await custom.exists(), isTrue, reason: 'custom target locations are not managed by the shell');
      expect(await notLog.exists(), isTrue);
    });

    test('the first write prunes, and so does the first write after midnight', () async {
      final old = await seed('internal/logs/app_20260101.log', DateTime(2026, 1, 1));
      final service = serviceWith(const LogRetention(maxAge: Duration(days: 14), maxBytes: null));

      await service.append('info', 'first');
      expect(await old.exists(), isFalse);

      final newlyExpired = await seed('internal/logs/app_20261010.log', DateTime(2026, 10, 10));
      await service.append('info', 'same day');
      expect(await newlyExpired.exists(), isTrue, reason: 'no re-scan within the same day');

      clock = DateTime(2026, 10, 30, 0, 0, 1);
      await service.append('info', 'next day');
      expect(await newlyExpired.exists(), isFalse);
      expect(await File(p.join(root.path, 'internal/logs/app_20261029.log')).exists(), isTrue);
      expect(await File(p.join(root.path, 'internal/logs/app_20261030.log')).exists(), isTrue);
    });

    test('unlimited retention never deletes', () async {
      final old = await seed('internal/logs/app_20000101.log', DateTime(2000));
      await serviceWith(LogRetention.unlimited).append('info', 'x');
      expect(await old.exists(), isTrue);
    });

    test('a failing prune never breaks writing', () async {
      final service = LogService(
        rootResolver: (provider) async => Directory(p.join(root.path, provider.name)),
        now: () => clock,
      );
      await service.append('info', 'ok');
      expect(await File(p.join(root.path, 'internal/logs/app_20261029.log')).exists(), isTrue);
    });
  });
}
