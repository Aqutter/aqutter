import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import 'native_features.dart';
import 'permission_service.dart';

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

/// 預設頻道；rev 1 只有這一個（契約 §5）。
const String notificationChannelId = 'aqutter_default';
const String notificationChannelName = '通知';

/// 包住 `flutter_local_notifications` 的預設實作（Android、iOS、macOS）。
class PluginLocalNotifier implements LocalNotifier {
  PluginLocalNotifier([FlutterLocalNotificationsPlugin? plugin]) : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;

  static const NotificationDetails _details = NotificationDetails(
    android: AndroidNotificationDetails(notificationChannelId, notificationChannelName),
    iOS: DarwinNotificationDetails(),
    macOS: DarwinNotificationDetails(),
  );

  @override
  Future<void> initialize(NotificationTapCallback onTap) async {
    // 權限一律由網頁經殼的權限 handler 處理，初始化時不要自己跳授權視窗
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: darwin,
        macOS: darwin,
      ),
      onDidReceiveNotificationResponse: (response) => onTap(response.id ?? 0, response.payload),
    );
  }

  @override
  Future<void> show(int id, String title, String body, String? payload) {
    return _plugin.show(id: id, title: title, body: body, notificationDetails: _details, payload: payload);
  }

  @override
  Future<void> schedule(int id, String title, String body, String? payload, DateTime atUtc) {
    return _plugin.zonedSchedule(
      id: id,
      title: title,
      body: body,
      payload: payload,
      scheduledDate: tz.TZDateTime.fromMillisecondsSinceEpoch(tz.UTC, atUtc.millisecondsSinceEpoch),
      notificationDetails: _details,
      // 不需要精確鬧鐘權限；系統可能延後數分鐘（契約 §5）
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
    );
  }

  @override
  Future<void> cancel(int id) => _plugin.cancel(id: id);

  @override
  Future<void> cancelAll() => _plugin.cancelAll();

  @override
  Future<NotificationLaunch?> launchedBy() async {
    final details = await _plugin.getNotificationAppLaunchDetails();
    final response = details?.notificationResponse;
    if (details == null || !details.didNotificationLaunchApp || response == null) {
      return null;
    }
    return NotificationLaunch(id: response.id ?? 0, payload: response.payload);
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
  })  : _notifier = notifier ?? PluginLocalNotifier(),
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
