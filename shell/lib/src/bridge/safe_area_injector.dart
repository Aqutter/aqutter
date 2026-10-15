import 'package:flutter/widgets.dart';
import 'package:aqutter_core/aqutter_core.dart';

/// Safe-area 注入器：把 host 量到的系統插邊寫進 WebView 的 `--safe-area-*` CSS 變數。
///
/// WebView 為 edge-to-edge（全屏、不包 SafeArea），留白改由網頁端負責：
/// `AppSafeArea` 與 app.vue 的狀態列 scrim 皆讀這組變數。
///
/// 寫入 `documentElement` 的 inline style，優先序高於 tailwind.css `:root` 的
/// `env(safe-area-inset-*)`，故兩平台一律以注入值為準；`env()` 僅在未注入的
/// 瀏覽器 / 桌面 dev 環境作為 fallback。
class SafeAreaInjector {
  AqutterWebViewController? _controller;

  /// 上次注入值；rebuild 頻率遠高於插邊變化，相同則不重複跨橋。
  EdgeInsets? _lastPadding;

  /// 綁定當前 WebView controller（onWebViewCreated 後呼叫）。
  set controller(AqutterWebViewController? controller) => _controller = controller;

  /// 注入插邊（單位為 logical pixel，與 WebView 的 CSS px 同一 ratio，可直接帶 `px`）。
  ///
  /// [force]：頁面（重）載入後 inline style 已被清掉，須無視快取重寫。
  Future<void> inject(EdgeInsets padding, {bool force = false}) async {
    final controller = _controller;
    if (controller == null) {
      return;
    }
    if (!force && padding == _lastPadding) {
      return;
    }
    _lastPadding = padding;
    await controller.evaluateJavascript(source: _sourceOf(padding));
  }

  /// CSS 變數前綴，對映 tailwind.css `:root` 與 SafeArea.vue 使用的名稱。
  static const String _variablePrefix = '--safe-area-';

  String _sourceOf(EdgeInsets padding) {
    final declarations = <String, double>{
      'top': padding.top,
      'bottom': padding.bottom,
      'left': padding.left,
      'right': padding.right,
    }
        .entries
        .map((entry) => "style.setProperty('$_variablePrefix${entry.key}', '${entry.value}px');")
        .join('\n  ');
    return '''
(function () {
  var style = document.documentElement.style;
  $declarations
})();
''';
  }
}
