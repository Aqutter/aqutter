import 'package:aqutter_core/aqutter_core.dart';

/// 網頁用 `getUserMedia` 要相機／麥克風時，WebView 會問宿主（`onPermissionRequest`）。
/// 沒人回答時 Android WebView 一律拒絕，即使系統層的權限已允許，所以殼要自己決定。
///
/// 放行條件（缺一不可）：
/// - 頁面來源是殼自己供應的：本機網頁包 server（[baseUrl]）或 dev server（[devUrl]）。
///   網頁包以外的內容（例如 in-app 開啟的外部網址）拿不到相機。
/// - 要求的資源只有相機與麥克風。要了別的資源就整個拒絕，不挑著給。
///
/// 系統層的使用者授權仍是前提：這裡放行只代表「殼不擋」，作業系統沒給權限時照樣取不到。
AqutterPermissionResponse decideMediaPermission(
  AqutterPermissionRequest request, {
  required Uri? baseUrl,
  String devUrl = '',
}) {
  if (!_isOwnOrigin(request.origin, baseUrl, devUrl) ||
      request.resources.isEmpty ||
      !request.resources.every(_mediaResources.contains)) {
    return AqutterPermissionResponse(action: AqutterPermissionResponseAction.DENY);
  }
  return AqutterPermissionResponse(
    resources: request.resources,
    action: AqutterPermissionResponseAction.GRANT,
  );
}

final Set<AqutterPermissionResourceType> _mediaResources = {
  AqutterPermissionResourceType.CAMERA,
  AqutterPermissionResourceType.MICROPHONE,
  AqutterPermissionResourceType.CAMERA_AND_MICROPHONE,
};

bool _isOwnOrigin(Uri origin, Uri? baseUrl, String devUrl) {
  final own = <Uri>[?baseUrl, if (devUrl.isNotEmpty) Uri.parse(devUrl)];
  return own.any(
    (uri) => uri.scheme == origin.scheme && uri.host == origin.host && uri.port == origin.port,
  );
}
