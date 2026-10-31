import 'dart:typed_data';

import '../../plugin/aqutter_plugin.dart';
import '../../bridge/safe_file_name.dart';

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

/// 分享檔案與剪貼簿圖片的上限（契約 §3）。
const int maxShareFiles = 5;
const int maxBinaryBytes = 5242880;

/// 圖片太大（讀取剪貼簿時）。
const String nativeTooLarge = 'too_large';

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

/// 要分享的檔案；位元組由網頁帶來，殼只暫存、不修改。
class ShareFile {
  const ShareFile({required this.name, required this.mimeType, required this.bytes});

  /// 單一檔名（規則同下載檔名）。
  final String name;
  final String mimeType;
  final Uint8List bytes;
}

/// 依副檔名判斷 MIME；判斷不出來用 `application/octet-stream`。
String mimeTypeForFileName(String name) {
  final dot = name.lastIndexOf('.');
  final extension = dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
  return switch (extension) {
    'png' => 'image/png',
    'jpg' || 'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'svg' => 'image/svg+xml',
    'pdf' => 'application/pdf',
    'txt' => 'text/plain',
    'json' => 'application/json',
    'csv' => 'text/csv',
    'zip' => 'application/zip',
    _ => 'application/octet-stream',
  };
}

Uint8List _requiredBytes(Object? value, String key) {
  if (value is Uint8List) {
    if (value.length > maxBinaryBytes) {
      throw NativeArgumentException('$key 不得超過 $maxBinaryBytes 位元組');
    }
    return value;
  }
  throw NativeArgumentException('$key 必須是位元組（Uint8Array）');
}

/// `share_open` 的參數。
class ShareRequest {
  const ShareRequest({this.text, this.url, this.subject, this.files = const []});

  factory ShareRequest.parse(Map<String, dynamic> payload) {
    final text = _optionalString(payload, 'text', maxShareLength);
    final url = _optionalString(payload, 'url', maxShareLength);
    final subject = _optionalString(payload, 'subject', maxShareLength);
    final files = _parseShareFiles(payload['files']);
    final hasText = text != null && text.isNotEmpty;
    final hasUrl = url != null && url.isNotEmpty;
    if (!hasText && !hasUrl && files.isEmpty) {
      throw const NativeArgumentException('text、url、files 至少要有一個有內容');
    }
    return ShareRequest(text: text, url: url, subject: subject, files: files);
  }

  static List<ShareFile> _parseShareFiles(Object? raw) {
    if (raw == null) {
      return const [];
    }
    if (raw is! List) {
      throw const NativeArgumentException('files 必須是陣列');
    }
    if (raw.length > maxShareFiles) {
      throw const NativeArgumentException('files 最多 $maxShareFiles 個');
    }
    return [
      for (final entry in raw)
        if (entry is Map) _parseShareFile(entry.cast<String, dynamic>()) else throw const NativeArgumentException('files 的每一項必須是物件'),
    ];
  }

  static ShareFile _parseShareFile(Map<String, dynamic> entry) {
    final name = entry['name'];
    final problem = downloadFileNameProblem(name);
    if (problem != null) {
      throw NativeArgumentException(problem.replaceFirst('fileName', 'files.name'));
    }
    final explicit = _optionalString(entry, 'mimeType', 255);
    return ShareFile(
      name: name as String,
      mimeType: explicit == null || explicit.isEmpty ? mimeTypeForFileName(name) : explicit,
      bytes: _requiredBytes(entry['data'], 'files.data'),
    );
  }

  final String? text;
  final String? url;
  final String? subject;
  final List<ShareFile> files;

  /// 兩者都有時合成一段文字（分享面板只收一段內容）；只有網址時回 null，改以網址分享。
  String? get combinedText {
    final hasText = text != null && text!.isNotEmpty;
    final hasUrl = url != null && url!.isNotEmpty;
    if (hasText && hasUrl) {
      return '$text\n$url';
    }
    return hasText ? text : null;
  }

  /// 分享檔案時用：文字與網址（有的話）合成一段，沒有就回 null。
  String? get textWithUrl {
    final parts = [
      if (text != null && text!.isNotEmpty) text!,
      if (url != null && url!.isNotEmpty) url!,
    ];
    return parts.isEmpty ? null : parts.join('\n');
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

/// 剪貼簿圖片的格式。
enum ClipboardImageFormat { png, jpeg }

/// `clipboard_write_image` 的參數；位元組開頭必須與宣告的格式相符。
class ClipboardImageWrite {
  const ClipboardImageWrite({required this.bytes, required this.format});

  factory ClipboardImageWrite.parse(Map<String, dynamic> payload) {
    final bytes = _requiredBytes(payload['data'], 'data');
    final mime = _optionalString(payload, 'mimeType', 255) ?? 'image/png';
    final format = switch (mime) {
      'image/png' => ClipboardImageFormat.png,
      'image/jpeg' => ClipboardImageFormat.jpeg,
      _ => throw const NativeArgumentException('mimeType 只能是 image/png 或 image/jpeg'),
    };
    if (!_hasSignature(bytes, format)) {
      throw const NativeArgumentException('data 不是合法的 PNG 或 JPEG（與 mimeType 不符）');
    }
    return ClipboardImageWrite(bytes: bytes, format: format);
  }

  final Uint8List bytes;
  final ClipboardImageFormat format;

  static bool _hasSignature(Uint8List bytes, ClipboardImageFormat format) {
    switch (format) {
      case ClipboardImageFormat.png:
        const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        return bytes.length >= png.length && [for (var i = 0; i < png.length; i++) bytes[i] == png[i]].every((ok) => ok);
      case ClipboardImageFormat.jpeg:
        return bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
    }
  }
}

/// 把參數驗證失敗轉成回給網頁的錯誤資料，其餘例外照常往外丟。內建 plugin 的 handler 都經由它呼叫服務。
Future<dynamic> nativeCall(Future<dynamic> Function() body) async {
  try {
    return await body();
  }
  on NativeArgumentException catch (error) {
    return error.toPayload();
  }
}
