import 'dart:async';

import 'package:flutter/foundation.dart' show TargetPlatform;

import '../../plugin/aqutter_plugin.dart';
import 'deep_link_service.dart';

/// 內建 plugin `deeplink`：啟動 App 的連結（`initial`）與執行中收到的連結（事件 `received`）。
///
/// 只有 Android、iOS、macOS 有實作。啟動 App 的那一個連結不走事件；事件在網頁未連線時會被丟棄，
/// 冷啟資訊由 `initial` 提供。
class DeeplinkPlugin extends AqutterPlugin {
  DeeplinkPlugin({this._service});

  /// 只在支援的平台、被用到時才建立，其他平台不碰原生外掛。
  DeepLinkService? _service;

  DeepLinkService get _resolved => _service ??= DeepLinkService();

  @override
  String get id => 'deeplink';

  @override
  Set<TargetPlatform>? get supportedPlatforms => const {
        TargetPlatform.android,
        TargetPlatform.iOS,
        TargetPlatform.macOS,
      };

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'initial': (_) async => {'url': await _resolved.initial()},
      };

  @override
  void attach(AqutterPluginContext context) {
    unawaited(_resolved.listen((url) {
      unawaited(context.emit('received', {'url': url}));
    }));
  }

  @override
  void dispose() {
    unawaited(_service?.dispose());
  }
}
