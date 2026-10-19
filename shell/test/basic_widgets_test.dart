import 'package:aqutter/src/ui/basic_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child, {EdgeInsets viewInsets = EdgeInsets.zero}) {
  return Directionality(
    textDirection: TextDirection.ltr,
    child: MediaQuery(
      data: MediaQueryData(size: const Size(400, 800), viewInsets: viewInsets),
      child: Center(child: SizedBox(width: 400, height: 800, child: child)),
    ),
  );
}

void main() {
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first
      ..physicalSize = const Size(400, 800)
      ..devicePixelRatio = 1;
  });
  tearDown(() {
    final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  testWidgets('AqutterSurface shrinks its child by the keyboard height', (tester) async {
    await tester.pumpWidget(_app(
      const AqutterSurface(color: Color(0xFF000000), child: SizedBox.expand(key: Key('body'))),
      viewInsets: const EdgeInsets.only(bottom: 300),
    ));

    expect(tester.getSize(find.byKey(const Key('body'))).height, 500);
  });

  testWidgets('AqutterSurface removes the consumed inset for descendants', (tester) async {
    late EdgeInsets inner;
    await tester.pumpWidget(_app(
      AqutterSurface(
        color: const Color(0xFF000000),
        child: Builder(builder: (context) {
          inner = MediaQuery.viewInsetsOf(context);
          return const SizedBox();
        }),
      ),
      viewInsets: const EdgeInsets.only(bottom: 300),
    ));

    expect(inner.bottom, 0);
  });

  testWidgets('AqutterButton fires only when enabled', (tester) async {
    var taps = 0;
    Widget button(VoidCallback? onPressed) => _app(Center(
          child: AqutterButton(
            label: '重試',
            onPressed: onPressed,
            backgroundColor: const Color(0xFF006A6A),
            foregroundColor: const Color(0xFFFFFFFF),
          ),
        ));

    await tester.pumpWidget(button(() => taps++));
    await tester.tap(find.text('重試'));
    expect(taps, 1);

    await tester.pumpWidget(button(null));
    await tester.tap(find.text('重試'));
    expect(taps, 1);
  });

  testWidgets('AqutterProgressBar fills the given fraction', (tester) async {
    await tester.pumpWidget(_app(const Center(
      child: SizedBox(
        width: 200,
        child: AqutterProgressBar(value: 0.25, color: Color(0xFF006A6A), trackColor: Color(0x1F000000)),
      ),
    )));

    final fill = find.descendant(of: find.byType(AqutterProgressBar), matching: find.byType(FractionallySizedBox));
    expect(tester.getSize(fill).width, 50);
  });

  testWidgets('AqutterProgressBar animates only while indeterminate', (tester) async {
    Widget bar(double? value) => _app(Center(
          child: SizedBox(
            width: 200,
            child: AqutterProgressBar(value: value, color: const Color(0xFF006A6A), trackColor: const Color(0x1F000000)),
          ),
        ));

    await tester.pumpWidget(bar(null));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.hasRunningAnimations, isTrue);

    await tester.pumpWidget(bar(0.5));
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
  });
}
