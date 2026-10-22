/// Aqutter 殼：以 Flutter 承載網頁（WebView + 內嵌本機 server + JS bridge）。
///
/// App 專案的 `main()` 呼叫 [runAqutter] 即可。
library;

export 'src/app.dart' show runAqutter, AqutterApp;
export 'src/aqutter_config.dart' show AqutterConfig;
export 'src/plugin/aqutter_plugin.dart'
    show
        AqutterPlugin,
        AqutterPluginContext,
        AqutterPluginHandler,
        aqutterErrorKey,
        aqutterErrorPayload,
        aqutterPluginEventChannel,
        aqutterPluginHandlerName,
        aqutterPluginIdPattern,
        aqutterPluginSupports,
        aqutterUnsupportedPlatform;
export 'package:aqutter_core/aqutter_core.dart'
    show
        AqutterNative,
        AqutterNativeQuality,
        AqutterNativeFormat,
        AqutterNativeFrame,
        AqutterNativeHost,
        AqutterNativeMessage,
        AqutterNativeSession,
        AqutterNativeCapture;
