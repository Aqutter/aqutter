import 'dart:async';

import 'package:flutter/foundation.dart' show TargetPlatform;

import '../../bridge/permission_service.dart';
import '../../plugin/aqutter_plugin.dart';
import '../_shared/native_features.dart';
import 'notification_service.dart';

/// 內建 plugin `notification`：本機通知（顯示、排程、取消、點通知冷啟的資訊）與事件 `tapped`。
///
/// 只有 Android、iOS、macOS 有實作。通知權限不會自動要求，沒授權時 `show`／`schedule` 回 `permission_denied`。
class NotificationPlugin extends AqutterPlugin {
  NotificationPlugin({required this._permissions, NotificationService? service}) : _serviceOverride = service;

  final AqutterPermissions _permissions;
  final NotificationService? _serviceOverride;

  /// 只在支援的平台、被用到時才建立，其他平台不碰原生外掛。
  late final NotificationService _service = _serviceOverride ?? NotificationService(permissions: _permissions);

  AqutterPluginContext? _context;

  @override
  String get id => 'notification';

  @override
  Set<TargetPlatform>? get supportedPlatforms => const {
        TargetPlatform.android,
        TargetPlatform.iOS,
        TargetPlatform.macOS,
      };

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'show': (payload) => nativeCall(() => _service.show(payload)),
        'schedule': (payload) => nativeCall(() => _service.schedule(payload)),
        'cancel': (payload) => nativeCall(() => _service.cancel(payload)),
        'initial': (_) async {
          await _start();
          return _service.initial();
        },
      };

  @override
  void attach(AqutterPluginContext context) {
    _context = context;
    unawaited(_start());
  }

  /// 初始化只做一次（服務本身可重複呼叫）。點通知事件在網頁未連線時會被丟棄，冷啟資訊由 `initial` 提供。
  Future<void> _start() {
    return _service.start((id, payload) {
      unawaited(_context?.emit('tapped', {'id': id, 'payload': payload}) ?? Future<void>.value());
    });
  }
}
