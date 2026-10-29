/// Aqutter 殼：以 Flutter 承載網頁（WebView + 內嵌本機 server + JS bridge）。
///
/// App 專案的 `main()` 呼叫 [runAqutter] 即可。
library;

export 'src/app.dart' show runAqutter, AqutterApp;
export 'src/aqutter_config.dart' show AqutterConfig, defaultWebPermissions;
export 'src/bridge/permission_service.dart' show AqutterPermissions;
export 'src/bridge/log_retention.dart' show LogRetention;
export 'src/error/aqutter_error_reporter.dart'
    show AqutterErrorReport, AqutterErrorReporter, AqutterErrorSource;
export 'src/plugin/aqutter_plugin.dart'
    show
        AqutterPlugin,
        AqutterPluginContext,
        AqutterPluginHandler,
        aqutterErrorKey,
        aqutterErrorOf,
        aqutterErrorPayload,
        aqutterPluginEventChannel,
        aqutterPluginHandlerName,
        aqutterPluginIdPattern,
        aqutterPluginSupports,
        aqutterReservedPluginId,
        aqutterUnsupportedPlatform;
export 'package:aqutter_core/aqutter_core.dart'
    show
        AqutterNative,
        AqutterNativeQuality,
        AqutterNativeFormat,
        AqutterNativeFrame,
        AqutterRpcException,
        AqutterNativeHost,
        AqutterNativeMessage,
        AqutterNativeSession,
        AqutterNativeCapture,
        AqutterPermissionResourceType;
