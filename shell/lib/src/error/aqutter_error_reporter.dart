import 'dart:math';

/// 錯誤來源。`flutter` / `platform` / `native` 會進入待送紀錄（與 aqutter-js 的 `CrashSource` 成對）；
/// `web` 只派給 [AqutterErrorReporter]，網頁已自行寫檔，不進待送紀錄。
enum AqutterErrorSource { flutter, platform, native, web }

/// 一筆錯誤紀錄。
class AqutterErrorReport {
  const AqutterErrorReport({
    required this.id,
    required this.time,
    required this.source,
    required this.fatal,
    required this.message,
    this.stack,
    this.extra,
  });

  /// 建立一筆新紀錄：產生 [id]、取當下 UTC 時間，並截斷過長的訊息與堆疊。
  factory AqutterErrorReport.create({
    required AqutterErrorSource source,
    required bool fatal,
    required String message,
    String? stack,
    Map<String, String>? extra,
    DateTime? now,
    Random? random,
  }) {
    final time = (now ?? DateTime.now()).toUtc();
    final suffix = (random ?? Random()).nextInt(0x1000000).toRadixString(16).padLeft(6, '0');
    return AqutterErrorReport(
      id: '${time.millisecondsSinceEpoch}-$suffix',
      time: time,
      source: source,
      fatal: fatal,
      message: _truncate(message, maxMessageLength),
      stack: stack == null ? null : _truncate(stack, maxStackLength),
      extra: extra == null || extra.isEmpty ? null : extra,
    );
  }

  factory AqutterErrorReport.fromJson(Map<String, dynamic> json) {
    final extra = json['extra'];
    return AqutterErrorReport(
      id: json['id'] as String,
      time: DateTime.parse(json['time'] as String).toUtc(),
      source: AqutterErrorSource.values.byName(json['source'] as String),
      fatal: json['fatal'] as bool,
      message: json['message'] as String,
      stack: json['stack'] as String?,
      extra: extra is Map ? extra.map((key, value) => MapEntry('$key', '$value')) : null,
    );
  }

  /// 訊息長度上限（字元）。
  static const int maxMessageLength = 8 * 1024;

  /// 堆疊長度上限（字元）。
  static const int maxStackLength = 32 * 1024;

  /// 唯一 id：`{epochMs}-{6 碼 hex}`。
  final String id;

  /// 發生當下（UTC）。
  final DateTime time;
  final AqutterErrorSource source;
  final bool fatal;
  final String message;
  final String? stack;
  final Map<String, String>? extra;

  /// 線上格式與 spool 檔案內容（與 aqutter-js 的 `CrashReportPayload` 成對）。
  Map<String, dynamic> toJson() => {
        'id': id,
        'time': time.toIso8601String(),
        'source': source.name,
        'fatal': fatal,
        'message': message,
        if (stack != null) 'stack': stack,
        if (extra != null) 'extra': extra,
      };

  static String _truncate(String text, int limit) {
    return text.length <= limit ? text : '${text.substring(0, limit)}…[truncated]';
  }
}

/// 錯誤回報接口：殼把 Dart 端與網頁端的未捕捉錯誤派給所有已註冊的 reporter。
///
/// 預留給 Firebase Crashlytics 等服務——殼本身不依賴它們，實作端自行接線。
/// [report] 丟出的例外會被殼吞掉，不影響其他 reporter 或殼本身。
abstract class AqutterErrorReporter {
  void report(AqutterErrorReport report);
}
