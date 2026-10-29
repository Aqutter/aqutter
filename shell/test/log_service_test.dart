import 'dart:io';

import 'package:aqutter/src/bridge/log_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

void main() {
  late Directory root;
  late LogService service;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('aqutter_log_test');
    service = LogService(
      rootResolver: (provider) async => provider == LogProvider.external ? null : Directory(p.join(root.path, provider.name)),
    );
  });

  tearDown(() async {
    await root.delete(recursive: true);
  });

  Future<List<File>> filesUnder(String relative) async {
    final dir = Directory(p.join(root.path, relative));
    if (!await dir.exists()) {
      return [];
    }
    return dir.list(recursive: true).where((e) => e is File).cast<File>().toList();
  }

  group('LogTarget.fromJson', () {
    test('uses defaults for omitted fields', () {
      final target = LogTarget.fromJson(<String, dynamic>{});
      expect(target.provider, LogProvider.internal);
      expect(target.dir, 'logs');
      expect(target.name, isNull);
    });

    test('parses every provider name', () {
      for (final provider in LogProvider.values) {
        expect(LogTarget.fromJson({'provider': provider.name}).provider, provider);
      }
    });

    test('rejects an unknown provider, non-object target and non-string fields', () {
      expect(() => LogTarget.fromJson({'provider': 'sdcard'}), throwsA(isA<LogTargetException>()));
      expect(() => LogTarget.fromJson('x'), throwsA(isA<LogTargetException>()));
      expect(() => LogTarget.fromJson({'dir': 1}), throwsA(isA<LogTargetException>()));
      expect(() => LogTarget.fromJson({'name': 1}), throwsA(isA<LogTargetException>()));
    });
  });

  group('validation', () {
    test('accepts nested relative dirs', () {
      expect(validateLogDir('sync/order-1/v1.2'), ['sync', 'order-1', 'v1.2']);
    });

    test('rejects traversal, absolute, empty and unsafe segments', () {
      for (final bad in ['', '..', 'a/../b', '.', './a', '/abs', 'a//b', 'a/', r'a\b', 'a b', '中文']) {
        expect(() => validateLogDir(bad), throwsA(isA<LogTargetException>()), reason: bad);
      }
    });

    test('rejects more than 8 segments and more than 128 characters', () {
      expect(() => validateLogDir('a/b/c/d/e/f/g/h/i'), throwsA(isA<LogTargetException>()));
      expect(() => validateLogDir('a' * 129), throwsA(isA<LogTargetException>()));
      expect(validateLogDir('a/b/c/d/e/f/g/h'), hasLength(8));
    });

    test('file name key is limited to 64 safe characters', () {
      validateLogName('order_1.v2-x');
      for (final bad in ['', 'a/b', '..a/b', 'a' * 65, 'a b']) {
        expect(() => validateLogName(bad), throwsA(isA<LogTargetException>()), reason: bad);
      }
    });

    test('exception text starts with the error code', () {
      expect(const LogTargetException('log_invalid_target', 'x').toString(), startsWith('log_invalid_target'));
    });
  });

  group('append with a target', () {
    test('writes under {root}/{dir}/{name}_{yyyyMMdd}.log with the standard line format', () async {
      await service.append(
        'info',
        'hello',
        target: const LogTarget(provider: LogProvider.documents, dir: 'sync/order', name: 'order'),
      );

      final files = await filesUnder('documents/sync/order');
      expect(files, hasLength(1));
      expect(p.basename(files.single.path), matches(RegExp(r'^order_\d{8}\.log$')));
      expect(await files.single.readAsString(), matches(RegExp(r'^\d{4}-.*? \[info\] hello\n$')));
    });

    test('appends to the same file and falls back to the current key when name is omitted', () async {
      service.setKey('main');
      const target = LogTarget(provider: LogProvider.cache);
      await service.append('info', 'one', target: target);
      await service.append('warn', 'two', target: target);

      final files = await filesUnder('cache/logs');
      expect(files, hasLength(1));
      expect(p.basename(files.single.path), startsWith('main_'));
      expect((await files.single.readAsString()).trim().split('\n'), hasLength(2));
    });

    test('an unavailable provider fails with log_provider_unavailable and writes nothing', () async {
      await expectLater(
        service.append('info', 'x', target: const LogTarget(provider: LogProvider.external)),
        throwsA(isA<LogTargetException>().having((e) => e.code, 'code', 'log_provider_unavailable')),
      );
      expect(await filesUnder('.'), isEmpty);
    });

    test('an invalid dir fails with log_invalid_target before touching the file system', () async {
      await expectLater(
        service.append('info', 'x', target: const LogTarget(dir: '../escape')),
        throwsA(isA<LogTargetException>().having((e) => e.code, 'code', 'log_invalid_target')),
      );
      expect(await filesUnder('.'), isEmpty);
    });

    test('an unsafe current key is rejected when the target does not name a file', () async {
      service.setKey('../evil');
      await expectLater(
        service.append('info', 'x', target: const LogTarget()),
        throwsA(isA<LogTargetException>()),
      );
    });
  });
}
