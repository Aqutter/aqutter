import 'package:flutter/services.dart';

import '../../plugin/aqutter_plugin.dart';
import '../_shared/native_features.dart';
import 'clipboard_image_service.dart';

/// 內建 plugin `clipboard`：剪貼簿的文字與圖片（契約見 docs/native-features.md）。
///
/// 文字全平台可用；圖片的原生程式在殼套件自己的平台資料夾，只有下列平台有實作。
class ClipboardPlugin extends AqutterPlugin {
  ClipboardPlugin({ClipboardImageService? images}) : _imagesOverride = images;

  final ClipboardImageService? _imagesOverride;

  /// 只在用到圖片時才建立，其他情況不碰原生外掛。
  late final ClipboardImageService _images = _imagesOverride ?? ClipboardImageService();

  static const Set<TargetPlatform> _imagePlatforms = {
    TargetPlatform.android,
    TargetPlatform.iOS,
    TargetPlatform.macOS,
    TargetPlatform.windows,
  };

  @override
  String get id => 'clipboard';

  @override
  Set<TargetPlatform>? supportedPlatformsFor(String method) {
    return method == 'readImage' || method == 'writeImage' ? _imagePlatforms : super.supportedPlatformsFor(method);
  }

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'read': (_) async {
          final data = await Clipboard.getData(Clipboard.kTextPlain);
          return {'text': data?.text};
        },
        'write': (payload) {
          return nativeCall(() async {
            await Clipboard.setData(ClipboardData(text: parseClipboardText(payload)));
            return {'ok': true};
          });
        },
        'readImage': (_) => nativeCall(() => _images.read()),
        'writeImage': (payload) => nativeCall(() => _images.write(payload)),
      };
}
