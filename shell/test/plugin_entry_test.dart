import 'dart:async';

import 'package:aqutter/aqutter.dart';
import 'package:aqutter/src/plugin/plugin_entry.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Plugin extends AqutterPlugin {
  _Plugin(this.id, {this.note = ''});

  @override
  final String id;
  final String note;
}

void main() {
  final context = AqutterBootContext(platform: TargetPlatform.android);

  test('plugins and builders can be mixed, and the order of the list is kept', () async {
    final order = <String>[];
    final resolved = await resolvePluginEntries([
      _Plugin('first'),
      AqutterPluginBuilder('second', (_) {
        order.add('second');
        return _Plugin('second');
      }),
      AqutterPluginBuilder('third', (_) async {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        order.add('third');
        return _Plugin('third');
      }),
      _Plugin('fourth'),
    ], context);

    expect(resolved.map((p) => p.id), ['first', 'second', 'third', 'fourth']);
    expect(order, ['second', 'third'], reason: 'builders run one after the other, in list order');
  });

  test('builders run one at a time: the next one starts only after the previous one finished', () async {
    var firstDone = false;
    var secondSawFirstDone = false;
    await resolvePluginEntries([
      AqutterPluginBuilder('first', (_) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        firstDone = true;
        return _Plugin('first');
      }),
      AqutterPluginBuilder('second', (_) {
        secondSawFirstDone = firstDone;
        return _Plugin('second');
      }),
    ], context);

    expect(secondSawFirstDone, isTrue);
  });

  test('a builder receives the boot context and can use it to configure the plugin', () async {
    final resolved = await resolvePluginEntries([
      AqutterPluginBuilder('mapped', (ctx) => _Plugin('mapped', note: ctx.platform.name)),
    ], context);

    expect((resolved.single as _Plugin).note, 'android');
  });

  test('a plain List<AqutterPlugin> still works as a list of entries', () async {
    final List<AqutterPlugin> old = [_Plugin('a'), _Plugin('b')];
    final List<AqutterPluginEntry> asEntries = old;

    expect((await resolvePluginEntries(asEntries, context)).map((p) => p.id), ['a', 'b']);
  });

  test('an empty list resolves to an empty list', () async {
    expect(await resolvePluginEntries(const [], context), isEmpty);
  });

  test('a builder that throws fails the whole startup and says which plugin', () async {
    await expectLater(
      resolvePluginEntries([
        _Plugin('fine'),
        AqutterPluginBuilder('google-maps', (_) => throw StateError('no api key')),
      ], context),
      throwsA(isA<AqutterPluginInitException>()
          .having((e) => e.name, 'name', 'google-maps')
          .having((e) => e.toString(), 'message', allOf(contains("plugin 'google-maps' 初始化失敗"), contains('no api key')))),
    );
  });

  test('an async builder that fails is reported the same way', () async {
    await expectLater(
      resolvePluginEntries([
        AqutterPluginBuilder('db', (_) async {
          await Future<void>.delayed(Duration.zero);
          throw StateError('cannot open');
        }),
      ], context),
      throwsA(isA<AqutterPluginInitException>().having((e) => e.name, 'name', 'db')),
    );
  });

  test('a builder that takes too long fails with a timeout instead of hanging the startup', () async {
    final never = Completer<AqutterPlugin>();

    await expectLater(
      resolvePluginEntries(
        [AqutterPluginBuilder('slow', (_) => never.future)],
        context,
        timeout: const Duration(milliseconds: 50),
      ),
      throwsA(isA<AqutterPluginInitException>()
          .having((e) => e.name, 'name', 'slow')
          .having((e) => e.toString(), 'message', contains('秒'))),
    );
  });

  test('builders after a failing one are not run', () async {
    var ran = false;
    await expectLater(
      resolvePluginEntries([
        AqutterPluginBuilder('bad', (_) => throw StateError('x')),
        AqutterPluginBuilder('later', (_) {
          ran = true;
          return _Plugin('later');
        }),
      ], context),
      throwsA(isA<AqutterPluginInitException>()),
    );

    expect(ran, isFalse);
  });

  test('the default timeout is 30 seconds', () {
    expect(aqutterPluginBuildTimeout, const Duration(seconds: 30));
  });

  testWidgets('a builder that fails shows the startup error screen with the plugin name', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(AqutterApp(
      plugins: [AqutterPluginBuilder('google-maps', (_) => throw StateError('no api key'))],
    ));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(find.textContaining("plugin 'google-maps' 初始化失敗"), findsOneWidget);
    expect(find.textContaining('no api key'), findsOneWidget);
  });
}
