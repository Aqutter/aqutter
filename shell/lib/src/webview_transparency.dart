import 'dart:async';

import 'package:flutter/foundation.dart';

/// 讓 WebView 的透明狀態跟著穿透中的工作階段數走。
///
/// 穿透模式（`AqutterNative` 的 `mode`）把原生內容畫在 WebView **下面**，WebView 不透明就看不到。
/// 所以有任何工作階段是穿透時 WebView 要透明，沒有時還原——不是全域常開：沒有穿透的畫面（包含啟動）不該露出底層。
///
/// [sessions] 是 `AqutterNativeHost.instance.passthroughSessions`；[apply] 實際改變 WebView 的透明設定。
/// 套用失敗時呼叫 [onError] 並停止重試（直到下一個 WebView 掛上）：呼叫端藉此通知 core 之後的協商一律退回鏡像
/// （`AqutterNativeHost.passthroughAvailable = false`）。
///
/// 一次只做一個 [apply]，做完再比對最新的需求，所以連續快速的 0→1→0 不會讓多個請求交錯。
class WebViewTransparency {
  WebViewTransparency({required this.sessions, required this.apply, required this.onError}) {
    sessions.addListener(_sync);
  }

  final ValueListenable<int> sessions;
  final Future<void> Function(bool transparent) apply;
  final void Function(Object error) onError;

  /// 目前需要 WebView 透明嗎。
  bool get wanted => sessions.value > 0;

  bool _attached = false;
  bool _applied = false;
  bool _busy = false;
  bool _failed = false;
  bool _disposed = false;

  /// 有 WebView 掛上了。[transparent] 是它建立時的透明設定（建立時就用 [wanted] 當初始值，掛上後只補差異）。
  void attach({required bool transparent}) {
    _attached = true;
    _applied = transparent;
    _failed = false;
    _sync();
  }

  /// WebView 即將被換掉或移除：之後的需求變化不要再套用到舊的 controller。
  void detach() => _attached = false;

  void dispose() {
    _disposed = true;
    _attached = false;
    sessions.removeListener(_sync);
  }

  void _sync() {
    if (_disposed || !_attached || _busy || _failed || wanted == _applied) {
      return;
    }
    unawaited(_run());
  }

  Future<void> _run() async {
    _busy = true;
    final target = wanted;
    try {
      await apply(target);
      _applied = target;
    }
    catch (error) {
      _failed = true;
      onError(error);
    }
    finally {
      _busy = false;
    }
    _sync(); // 套用期間需求可能又變了
  }
}
