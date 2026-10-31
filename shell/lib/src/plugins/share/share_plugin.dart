import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../plugin/aqutter_plugin.dart';
import '../_shared/native_features.dart';
import 'share_files.dart';

/// 內建 plugin `share`：系統分享面板（文字、網址、檔案）。全平台可用。
class SharePlugin extends AqutterPlugin {
  @override
  String get id => 'share';

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'open': (payload) {
          return nativeCall(() async {
            final request = ShareRequest.parse(payload);
            final ShareResult result;
            if (request.files.isNotEmpty) {
              result = await shareFiles(request, tempRoot: await getTemporaryDirectory());
              return {'status': _status(result)};
            }
            final text = request.combinedText;
            final uri = text == null ? Uri.tryParse(request.url ?? '') : null;
            result = await SharePlus.instance.share(
              ShareParams(text: text ?? (uri == null ? request.url : null), uri: uri, subject: request.subject),
            );
            return {'status': _status(result)};
          });
        },
      };

  static String _status(ShareResult result) {
    return switch (result.status) {
      ShareResultStatus.success => 'shared',
      ShareResultStatus.dismissed => 'dismissed',
      ShareResultStatus.unavailable => 'unavailable',
    };
  }
}
