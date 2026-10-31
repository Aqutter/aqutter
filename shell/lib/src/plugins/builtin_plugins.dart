import '../bridge/permission_service.dart';
import '../plugin/aqutter_plugin.dart';
import 'clipboard/clipboard_image_service.dart';
import 'clipboard/clipboard_plugin.dart';
import 'deeplink/deep_link_service.dart';
import 'deeplink/deeplink_plugin.dart';
import 'notification/notification_plugin.dart';
import 'notification/notification_service.dart';
import 'share/share_plugin.dart';

/// 殼內建的 plugin id；App 傳入的 plugin 不得與它們同名。
const List<String> builtinPluginIds = ['clipboard', 'share', 'notification', 'deeplink'];

/// 殼內建的 plugin：與 App 傳入的 plugin 走同一條註冊路徑（handler `<id>.<method>`、事件 `<id>.<event>`）。
///
/// 服務參數供測試注入；省略時各 plugin 在用到時才建立自己的服務。
List<AqutterPlugin> builtinPlugins({
  required AqutterPermissions permissions,
  NotificationService? notifications,
  DeepLinkService? deepLinks,
  ClipboardImageService? clipboardImages,
}) {
  return [
    ClipboardPlugin(images: clipboardImages),
    SharePlugin(),
    NotificationPlugin(permissions: permissions, service: notifications),
    DeeplinkPlugin(service: deepLinks),
  ];
}
