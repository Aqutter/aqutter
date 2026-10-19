// Aqutter shell smoke test：驗證 App 可建構並在首幀顯示啟動過場。
// 原生 bridge / server 於 onWebViewCreated 後才啟動，此處僅測首幀 UI，不觸及外掛 channel。

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aqutter/src/app.dart';
import 'package:aqutter/src/ui/startup_overlay.dart';

/// WCAG 2.1 的相對亮度。
double _relativeLuminance(Color color) {
  double channel(double value) {
    return value <= 0.03928 ? value / 12.92 : math.pow((value + 0.055) / 1.055, 2.4) as double;
  }

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/// 兩色的對比度（1–21）。
double _contrastRatio(Color a, Color b) {
  final la = _relativeLuminance(a);
  final lb = _relativeLuminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// 以指定的系統深淺色建構 App，並取回首幀的過場。
Future<StartupOverlay> _overlayUnderBrightness(
  WidgetTester tester,
  Brightness brightness,
) async {
  tester.platformDispatcher.platformBrightnessTestValue = brightness;
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

  await tester.pumpWidget(const AqutterApp());
  return tester.widget<StartupOverlay>(find.byType(StartupOverlay));
}

void main() {
  testWidgets('AqutterApp renders the startup overlay on first frame', (WidgetTester tester) async {
    await tester.pumpWidget(const AqutterApp());

    expect(find.byType(WidgetsApp), findsOneWidget);
    // 首幀 _baseUrl / _error 皆為 null，_stage 仍是初始值 → 過場顯示第一個階段。
    expect(find.byType(StartupOverlay), findsOneWidget);
    expect(find.text(StartupStage.preparingBundle.message), findsOneWidget);
  });

  testWidgets('every stage carries a non-empty label', (WidgetTester tester) async {
    // 階段文字是過場的唯一資訊來源，漏填會讓該階段變成一個沒有說明的 spinner
    for (final stage in StartupStage.values) {
      expect(stage.message, isNotEmpty, reason: '${stage.name} 缺少階段文字');
    }
  });

  // 這是本測試檔存在的主要理由：底色由原生自己算，文字色若忘了一起算，就會被
  // 預設主題 固定成近黑——深色模式下實測只有 1.07:1。
  // 靜態分析與型別都攔不住這種「顏色錯了但程式正確」的缺陷，只能用斷言守。
  for (final brightness in Brightness.values) {
    testWidgets('startup overlay text is readable in ${brightness.name}', (WidgetTester tester) async {
      final overlay = await _overlayUnderBrightness(tester, brightness);

      final ratio = _contrastRatio(overlay.foregroundColor, overlay.backgroundColor);
      expect(
        ratio,
        greaterThanOrEqualTo(4.5),
        reason: '${brightness.name} 的階段文字對比度僅 ${ratio.toStringAsFixed(2)}:1，低於 WCAG AA 的 4.5',
      );
    });
  }

  testWidgets('startup overlay colors follow the effective brightness', (WidgetTester tester) async {
    final light = await _overlayUnderBrightness(tester, Brightness.light);
    final lightColors = (light.backgroundColor, light.foregroundColor, light.indicatorColor);

    final dark = await _overlayUnderBrightness(tester, Brightness.dark);
    final darkColors = (dark.backgroundColor, dark.foregroundColor, dark.indicatorColor);

    // 三個顏色都必須換過；只換底色正是原本的缺陷
    expect(darkColors, isNot(equals(lightColors)));
    expect(dark.foregroundColor, isNot(equals(light.foregroundColor)));
    expect(dark.indicatorColor, isNot(equals(light.indicatorColor)));
  });
}
