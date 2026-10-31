import 'package:flutter/services.dart';

import '../_shared/native_features.dart';
import '../../bridge/permission_service.dart';

/// 使用者點了通知的回呼：[id] 為通知 id，[payload] 為顯示時帶的字串。
typedef NotificationTapCallback = void Function(int id, String? payload);

/// 點通知而冷啟 App 時帶回的資訊。
class NotificationLaunch {
  const NotificationLaunch({required this.id, required this.payload});

  final int id;
  final String? payload;
}

/// 本機通知的平台層；與 [NotificationService] 分開，測試才能不碰原生外掛。
abstract class LocalNotifier {
  Future<void> initialize(NotificationTapCallback onTap);

  Future<void> show(int id, String title, String body, String? payload);

  /// 以 UTC 絕對時間點排程，不依賴本地時區。
  Future<void> schedule(int id, String title, String body, String? payload, DateTime atUtc);

  Future<void> cancel(int id);

  Future<void> cancelAll();

  /// 這個程序是不是因為點通知而啟動；不是則回 null。
  Future<NotificationLaunch?> launchedBy();
}

/// 與原生程式約定的 MethodChannel 名稱。原生端在殼套件自己的 Android（Java）、iOS 與 macOS（Swift）程式內。
///
/// Dart → 原生：`initialize`、`show`、`schedule`、`cancel`、`cancelAll`、`launchedBy`；
/// 原生 → Dart：`tapped`（`{ id, payload }`，App 執行中使用者點了通知）。
const String notificationsChannel = 'com.github.aqutter/notifications';

/// 殼自己的原生實作（Android、iOS、macOS），不依賴任何外部通知套件。
class PlatformLocalNotifier implements LocalNotifier {
  PlatformLocalNotifier([MethodChannel? channel]) : _channel = channel ?? const MethodChannel(notificationsChannel);

  final MethodChannel _channel;

  @override
  Future<void> initialize(NotificationTapCallback onTap) async {
    _channel.setMethodCallHandler((call) async {
      if (call.method != 'tapped') {
        return;
      }
      final arguments = call.arguments;
      if (arguments is Map && arguments['id'] is int) {
        onTap(arguments['id'] as int, arguments['payload'] as String?);
      }
    });
    // 權限一律由網頁經殼的權限 handler 處理，原生端初始化時不要自己跳授權視窗
    await _channel.invokeMethod<void>('initialize');
  }

  @override
  Future<void> show(int id, String title, String body, String? payload) {
    return _channel.invokeMethod<void>('show', {'id': id, 'title': title, 'body': body, 'payload': payload});
  }

  @override
  Future<void> schedule(int id, String title, String body, String? payload, DateTime atUtc) {
    return _channel.invokeMethod<void>('schedule', {
      'id': id,
      'title': title,
      'body': body,
      'payload': payload,
      'atMs': atUtc.millisecondsSinceEpoch,
    });
  }

  @override
  Future<void> cancel(int id) => _channel.invokeMethod<void>('cancel', {'id': id});

  @override
  Future<void> cancelAll() => _channel.invokeMethod<void>('cancelAll');

  @override
  Future<NotificationLaunch?> launchedBy() async {
    final result = await _channel.invokeMethod<Map<Object?, Object?>>('launchedBy');
    final id = result?['id'];
    if (id is! int) {
      return null;
    }
    return NotificationLaunch(id: id, payload: result?['payload'] as String?);
  }
}

/// 本機通知服務：參數驗證、id 配發、權限檢查與點擊回傳。
///
/// 通知不自動要權限：網頁先用既有的權限 handler 取得 `notifications`，沒授權時
/// [show]／[schedule] 回 `permission_denied`（契約 §4）。
class NotificationService {
  NotificationService({
    LocalNotifier? notifier,
    AqutterPermissions? permissions,
    DateTime Function()? now,
  })  : _notifier = notifier ?? PlatformLocalNotifier(),
        _permissions = permissions ?? const AqutterPermissions(),
        _now = now ?? DateTime.now;

  final LocalNotifier _notifier;
  final AqutterPermissions _permissions;
  final DateTime Function() _now;

  Future<void>? _starting;
  int _nextId = 1;
  final Set<int> _usedIds = <int>{};
  NotificationLaunch? _launch;

  /// 初始化一次（可重複呼叫）並登記點擊回呼；取得「由通知冷啟」的資訊。
  Future<void> start(NotificationTapCallback onTap) {
    return _starting ??= () async {
      await _notifier.initialize(onTap);
      _launch = await _notifier.launchedBy();
    }();
  }

  /// `notify_initial`：點通知而冷啟時有值，否則兩者皆 null。同一個程序內重複呼叫回傳相同值。
  Map<String, dynamic> initial() => {'id': _launch?.id, 'payload': _launch?.payload};

  Future<Map<String, dynamic>> show(Map<String, dynamic> payload) async {
    final request = NotificationRequest.parse(payload, scheduled: false, now: _now().toUtc());
    await _requirePermission();
    final id = _claimId(request.id);
    await _notifier.show(id, request.title, request.body, request.payload);
    return {'id': id};
  }

  Future<Map<String, dynamic>> schedule(Map<String, dynamic> payload) async {
    final request = NotificationRequest.parse(payload, scheduled: true, now: _now().toUtc());
    await _requirePermission();
    final id = _claimId(request.id);
    await _notifier.schedule(id, request.title, request.body, request.payload, request.at!);
    return {'id': id};
  }

  Future<Map<String, dynamic>> cancel(Map<String, dynamic> payload) async {
    final id = parseCancelId(payload);
    if (id == null) {
      await _notifier.cancelAll();
      _usedIds.clear();
    }
    else {
      await _notifier.cancel(id);
      _usedIds.remove(id);
    }
    return {'ok': true};
  }

  Future<void> _requirePermission() async {
    if (await _permissions.check('notifications') != 'granted') {
      throw const NativeArgumentException('通知權限未授權，請先要求 notifications 權限', code: nativePermissionDenied);
    }
  }

  /// 顯式給的 id 原樣使用（再次使用同一個 id 會取代原通知）；省略時從 1 遞增，跳過這個程序已用過的 id。
  int _claimId(int? requested) {
    if (requested != null) {
      _usedIds.add(requested);
      return requested;
    }
    while (_usedIds.contains(_nextId)) {
      _nextId += 1;
    }
    final id = _nextId;
    _nextId += 1;
    _usedIds.add(id);
    return id;
  }
}
