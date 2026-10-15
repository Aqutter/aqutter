import 'dart:convert';

import 'package:aqutter_core/aqutter_core.dart';

/// 原生→JS 事件發射器：呼叫網頁端 `window.__flutterBridgeEmit(channel, payload)`。
///
/// 對接前端 `flutterBridge.ts` 掛載的全域派送函式。controller 於 WebView 建立後注入。
class BridgeEmitter {
  AqutterWebViewController? _controller;

  /// 綁定當前 WebView controller（onWebViewCreated 後呼叫）。
  set controller(AqutterWebViewController? controller) => _controller = controller;

  /// 派送事件到指定頻道。controller 尚未就緒時安全略過。
  Future<void> emit(String channel, Object? payload) async {
    final controller = _controller;
    if (controller == null) {
      return;
    }
    final channelLiteral = jsonEncode(channel);
    final payloadLiteral = jsonEncode(payload);
    final source =
        'window.__flutterBridgeEmit && window.__flutterBridgeEmit($channelLiteral, $payloadLiteral);';
    await controller.evaluateJavascript(source: source);
  }
}
