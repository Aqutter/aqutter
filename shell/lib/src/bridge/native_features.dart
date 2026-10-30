import '../plugin/aqutter_plugin.dart';

/// 剪貼簿、分享與本機通知的參數驗證。
///
/// 限制值與錯誤碼是跨 repo 的契約（見 aqutter-js 的 `BridgeHandler.ClipboardWrite` 等型別）：
/// 超過上限一律拒絕，不截斷，網頁才知道自己送了什麼。

/// 參數不合法；[code] 是回給網頁的 `aqutterError` 錯誤碼。
class NativeArgumentException implements Exception {
  const NativeArgumentException(this.message, {this.code = nativeInvalidArgument});

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';

  /// 轉成回給網頁的 `aqutterError` 資料。
  Map<String, dynamic> toPayload() => aqutterErrorPayload(code, message);
}

/// 欄位缺漏、型別錯、超過上限、排程時間已過。
const String nativeInvalidArgument = 'invalid_argument';

/// 系統通知權限未授權。
const String nativePermissionDenied = 'permission_denied';

const int maxClipboardLength = 1000000;
const int maxShareLength = 10000;
const int maxTitleLength = 200;
const int maxBodyLength = 2000;
const int maxPayloadLength = 1000;

const int _minInt32 = -2147483648;
const int _maxInt32 = 2147483647;

String _requiredString(Map<String, dynamic> payload, String key, int max) {
  final value = payload[key];
  if (value is! String) {
    throw NativeArgumentException('$key 必須是字串');
  }
  if (value.length > max) {
    throw NativeArgumentException('$key 長度不得超過 $max');
  }
  return value;
}

String? _optionalString(Map<String, dynamic> payload, String key, int max) {
  if (payload[key] == null) {
    return null;
  }
  return _requiredString(payload, key, max);
}

/// `clipboard_write` 的文字；空字串合法（用來清空）。
String parseClipboardText(Map<String, dynamic> payload) => _requiredString(payload, 'text', maxClipboardLength);

/// `share_open` 的參數。
class ShareRequest {
  const ShareRequest({this.text, this.url, this.subject});

  factory ShareRequest.parse(Map<String, dynamic> payload) {
    final text = _optionalString(payload, 'text', maxShareLength);
    final url = _optionalString(payload, 'url', maxShareLength);
    final subject = _optionalString(payload, 'subject', maxShareLength);
    if ((text == null || text.isEmpty) && (url == null || url.isEmpty)) {
      throw const NativeArgumentException('text 與 url 至少要有一個非空');
    }
    return ShareRequest(text: text, url: url, subject: subject);
  }

  final String? text;
  final String? url;
  final String? subject;

  /// 兩者都有時合成一段文字（分享面板只收一段內容）；只有網址時回 null，改以網址分享。
  String? get combinedText {
    final hasText = text != null && text!.isNotEmpty;
    final hasUrl = url != null && url!.isNotEmpty;
    if (hasText && hasUrl) {
      return '$text\n$url';
    }
    return hasText ? text : null;
  }
}

/// `notify_show`／`notify_schedule` 的參數。
class NotificationRequest {
  const NotificationRequest({required this.title, required this.body, this.id, this.payload, this.at});

  /// [scheduled] 為 true 時 `atMs` 必填且必須晚於 [now]。
  factory NotificationRequest.parse(Map<String, dynamic> payload, {required bool scheduled, required DateTime now}) {
    final title = _requiredString(payload, 'title', maxTitleLength);
    if (title.isEmpty) {
      throw const NativeArgumentException('title 不得為空');
    }
    final body = _optionalString(payload, 'body', maxBodyLength) ?? '';
    final extra = _optionalString(payload, 'payload', maxPayloadLength);

    int? id;
    final rawId = payload['id'];
    if (rawId != null) {
      if (rawId is! int || rawId < _minInt32 || rawId > _maxInt32) {
        throw const NativeArgumentException('id 必須是 32 位元整數');
      }
      id = rawId;
    }

    DateTime? at;
    if (scheduled) {
      final rawAt = payload['atMs'];
      if (rawAt is! int) {
        throw const NativeArgumentException('atMs 必須是整數（epoch 毫秒）');
      }
      at = DateTime.fromMillisecondsSinceEpoch(rawAt, isUtc: true);
      if (!at.isAfter(now)) {
        throw const NativeArgumentException('atMs 必須晚於目前時間');
      }
    }
    return NotificationRequest(title: title, body: body, id: id, payload: extra, at: at);
  }

  final int? id;
  final String title;
  final String body;
  final String? payload;

  /// 排程時間（UTC）；立即顯示時為 null。
  final DateTime? at;
}

/// `notify_cancel` 的 `id`；省略代表取消全部。
int? parseCancelId(Map<String, dynamic> payload) {
  final rawId = payload['id'];
  if (rawId == null) {
    return null;
  }
  if (rawId is! int || rawId < _minInt32 || rawId > _maxInt32) {
    throw const NativeArgumentException('id 必須是 32 位元整數');
  }
  return rawId;
}
