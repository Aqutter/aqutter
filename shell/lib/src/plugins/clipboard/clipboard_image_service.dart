import 'package:flutter/services.dart';

import '../_shared/native_features.dart';

/// 剪貼簿圖片的平台層；與 [ClipboardImageService] 分開，測試才能不碰原生程式。
abstract class ClipboardImageSource {
  /// 剪貼簿裡的圖片，一律是 PNG 位元組；沒有圖片回 null。
  Future<Uint8List?> readPng();

  /// 把圖片放進剪貼簿；[bytes] 已驗證為 [format] 指定的格式。
  Future<void> write(Uint8List bytes, ClipboardImageFormat format);
}

/// 殼套件自己的原生程式（Android、iOS、macOS、Windows），經 MethodChannel 呼叫。
class PlatformClipboardImageSource implements ClipboardImageSource {
  PlatformClipboardImageSource([MethodChannel? channel]) : _channel = channel ?? const MethodChannel(clipboardImageChannel);

  final MethodChannel _channel;

  @override
  Future<Uint8List?> readPng() => _channel.invokeMethod<Uint8List>('readImage');

  @override
  Future<void> write(Uint8List bytes, ClipboardImageFormat format) {
    return _channel.invokeMethod<void>('writeImage', {'data': bytes, 'format': format.name});
  }
}

/// 與原生程式約定的 MethodChannel 名稱。
const String clipboardImageChannel = 'com.github.aqutter/clipboard';

/// 剪貼簿圖片：參數驗證與大小上限（契約 §3）。
class ClipboardImageService {
  ClipboardImageService({ClipboardImageSource? source}) : _source = source ?? PlatformClipboardImageSource();

  final ClipboardImageSource _source;

  /// `clipboard_read_image`：沒有圖片回 `{ image: null }`；超過上限回 `too_large`，不截斷。
  Future<Map<String, dynamic>> read() async {
    final bytes = await _source.readPng();
    if (bytes == null || bytes.isEmpty) {
      return {'image': null};
    }
    if (bytes.length > maxBinaryBytes) {
      throw const NativeArgumentException('剪貼簿裡的圖片超過 5,242,880 位元組', code: nativeTooLarge);
    }
    return {
      'image': {'mimeType': 'image/png', 'data': bytes},
    };
  }

  /// `clipboard_write_image`。
  Future<Map<String, dynamic>> write(Map<String, dynamic> payload) async {
    final request = ClipboardImageWrite.parse(payload);
    await _source.write(request.bytes, request.format);
    return {'ok': true};
  }
}
