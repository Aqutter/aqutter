import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'bridge_names.dart';

/// 全透明；本模組僅 import `services.dart`（不引 material），故不使用 `Colors.transparent`。
const Color _kTransparent = Color(0x00000000);

/// Edge-to-edge 下的系統列樣式：底色一律透明，該區域顏色改由網頁內容與 app.vue 的
/// scrim 決定；圖示明暗則需與網頁 `bg-surface` 保持對比。
///
/// 刻意不用內建的 `SystemUiOverlayStyle.light` / `.dark`——它們把 `systemNavigationBarColor`
/// 寫死為黑色、`statusBarColor` 留 null（沿用系統灰色 scrim），兩條系統列會與內容不連續。
const SystemUiOverlayStyle kOverlayForDarkContent = SystemUiOverlayStyle(
  statusBarColor: _kTransparent,
  statusBarBrightness: Brightness.dark,
  statusBarIconBrightness: Brightness.light,
  systemNavigationBarColor: _kTransparent,
  systemNavigationBarDividerColor: _kTransparent,
  systemNavigationBarIconBrightness: Brightness.light,
);

const SystemUiOverlayStyle kOverlayForLightContent = SystemUiOverlayStyle(
  statusBarColor: _kTransparent,
  statusBarBrightness: Brightness.light,
  statusBarIconBrightness: Brightness.dark,
  systemNavigationBarColor: _kTransparent,
  systemNavigationBarDividerColor: _kTransparent,
  systemNavigationBarIconBrightness: Brightness.dark,
);

/// 系統列（狀態列 + 導航列）行為與樣式的單一來源。
///
/// main.dart（深淺色同步）與 bridge_registry.dart（JS 橋接的 statusbar_* handler）
/// 皆由此進出，避免兩處各自呼叫 `SystemChrome` 互相覆蓋。
class SystemBars {
  const SystemBars._();

  static const MethodChannel _hostChannel = MethodChannel(HostMethod.channel);

  /// 網頁端經 `theme_set` 回報的 App 主題亮度。
  ///
  /// 使用者可在 App 內把主題固定為淺/深色，此時系統列圖示與 Scaffold 底色必須跟著
  /// App 主題而非系統深淺色，否則會出現「深色圖示疊在深色內容上」的無對比狀況。
  /// `null` 代表網頁尚未回報（冷啟動到頁面就緒之間），此時退回 `platformBrightness`。
  static final ValueNotifier<Brightness?> appBrightness = ValueNotifier<Brightness?>(null);

  /// 套用透明系統列樣式；[darkContent] 為 true 表示網頁內容偏深，需搭配亮色圖示。
  static void applyOverlayStyle({required bool darkContent}) {
    SystemChrome.setSystemUIOverlayStyle(
      darkContent ? kOverlayForDarkContent : kOverlayForLightContent,
    );
  }

  /// 顯示 / 隱藏系統列，且**全程維持 edge-to-edge**。
  ///
  /// Android 刻意繞過 `SystemChrome.setEnabledSystemUIMode`：Flutter engine 對任何非
  /// `edgeToEdge` 的 mode 都會先 `WindowCompat.setDecorFitsSystemWindows(window, true)`，
  /// 視窗重新被系統列插邊內縮，WebView 畫不到那塊，露出 Activity 的 windowBackground
  /// 形成色帶；且 legacy 的 `View.SYSTEM_UI_FLAG_*` 自 targetSdk 35 起會被系統忽略。
  /// 改由 MainActivity 以 `WindowInsetsControllerCompat` 處理，見 [HostMethod]。
  ///
  /// 隱藏後 `WindowInsets` 的 systemBars inset 歸零，`MediaQuery.padding` 只剩
  /// displayCutout，SafeAreaInjector 會據此重新注入 `--safe-area-*`。
  static Future<void> setVisible(bool visible) async {
    if (Platform.isAndroid) {
      await _hostChannel.invokeMethod<void>(
        visible ? HostMethod.systemBarsShow : HostMethod.systemBarsHide,
      );
      return;
    }
    // iOS：沿用 SystemChrome 既有語意（隱藏＝狀態列與 home indicator 全隱）；桌面為 no-op
    await SystemChrome.setEnabledSystemUIMode(
      visible ? SystemUiMode.edgeToEdge : SystemUiMode.immersiveSticky,
    );
  }
}
