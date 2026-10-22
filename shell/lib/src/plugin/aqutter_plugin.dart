import 'package:flutter/widgets.dart';

/// plugin 暴露給網頁的方法：吃單一 JSON 物件，回傳可 JSON 序列化的結果。
typedef AqutterPluginHandler = Future<dynamic> Function(Map<String, dynamic> payload);

/// 網頁端看到的 handler 名稱：`<pluginId>.<method>`。
///
/// 與 TS 端 `@aqutter/aqutter` 的 `callPlugin(pluginId, method)` 組出的名稱必須一致；
/// 兩端都只經由這個規則組名，不各自拼字串。
String aqutterPluginHandlerName(String pluginId, String method) => '$pluginId.$method';

/// 網頁端監聽的事件頻道：`<pluginId>.<event>`。
String aqutterPluginEventChannel(String pluginId, String event) => '$pluginId.$event';

/// 合法的 plugin id：小寫字母開頭，其後為小寫字母、數字或連字號。
///
/// 不含 `.`——點號是 id 與方法名的分隔符，也避免與殼內建的 handler（無點號）撞名。
final RegExp aqutterPluginIdPattern = RegExp(r'^[a-z][a-z0-9-]*$');

/// 殼對 plugin 呼叫失敗時回傳的錯誤資料所用的欄位名（保留欄位，plugin 自己的回傳不得使用）。
///
/// 用資料而不是例外回報：例外如何傳回網頁取決於各原生平台的實作，無法逐一保證 Promise 會 reject。
/// 網頁端（`@aqutter/aqutter` 的 `callPlugin`）看到這個欄位就轉成拋出的 `AqutterPluginError`。
const String aqutterErrorKey = 'aqutterError';

/// plugin 不支援目前平台時的錯誤碼（見 [AqutterPlugin.supportedPlatforms]）。
const String aqutterUnsupportedPlatform = 'UNSUPPORTED_PLATFORM';

/// 組出殼的錯誤資料：`{ aqutterError: { code, message } }`。
Map<String, dynamic> aqutterErrorPayload(String code, String message) => {
      aqutterErrorKey: {'code': code, 'message': message},
    };

/// [plugin] 是否支援 [platform]：[AqutterPlugin.supportedPlatforms] 為 null 代表所有平台。
bool aqutterPluginSupports(AqutterPlugin plugin, TargetPlatform platform) {
  final supported = plugin.supportedPlatforms;
  return supported == null || supported.contains(platform);
}

/// plugin 與殼互動的入口，於 [AqutterPlugin.attach] 交給 plugin。
abstract class AqutterPluginContext {
  /// 對網頁派送事件；頻道自動加上 `<pluginId>.` 前綴。
  /// WebView 尚未就緒時安全略過。
  Future<void> emit(String event, Object? payload);
}

/// Aqutter plugin 的 Dart 端介面。
///
/// plugin 以一個 Dart 套件發佈，套件內提供實作本介面的類別；App 在 `runAqutter(plugins: [...])`
/// 傳入實例（`aqutter plugin add` 會代為維護這份清單）。plugin 可以：
///   - 以 [handlers] 對網頁暴露方法（網頁以 `callPlugin(id, method, payload)` 呼叫）
///   - 以 [attach] 取得 [AqutterPluginContext]，主動對網頁派送事件
///   - 以 [buildOverlay] 在 WebView 之上、以 [buildUnderlay] 在 WebView 之下掛原生 Flutter UI
///   - 自由相依其他 Flutter plugin（例如 battery_plus），其原生部分由 Flutter 工具鏈照常整合
abstract class AqutterPlugin {
  /// plugin 識別字，須符合 [aqutterPluginIdPattern]，並與網頁端套件使用的 id 一致。
  String get id;

  /// 這個 plugin 支援的平台；`null`（預設）代表所有平台，現有 plugin 行為不變。
  ///
  /// 目前平台不在集合內時：
  ///   - [handlers] 仍會註冊（網頁呼叫不會是 handler not found），但**不列入**能力表，
  ///     網頁以同步的 `isPluginSupported(id, method)` 即可得知並改走替代方案；
  ///   - 被呼叫時殼**不執行** handler，回傳 `{ aqutterError: { code: UNSUPPORTED_PLATFORM, … } }`，
  ///     網頁端的 `callPlugin` 會把它轉成拋出的 `AqutterPluginError`（不會卡住）；
  ///   - 殼不呼叫 [attach]、[buildUnderlay]、[buildOverlay]；[dispose] 仍會呼叫（必須可安全呼叫）。
  Set<TargetPlatform>? get supportedPlatforms => null;

  /// 暴露給網頁的方法，鍵為方法名（不含 id 前綴）。
  Map<String, AqutterPluginHandler> get handlers => const {};

  /// 殼就緒後呼叫一次；[context] 在 plugin 存活期間有效。
  void attach(AqutterPluginContext context) {}

  /// 墊在 WebView **之下**的原生內容；回傳 null 表示沒有。
  ///
  /// 用於「被網頁蓋住、但仍需在 Flutter 裡渲染」的內容——例如以 `AqutterNative` 鏡像到網頁的地圖。
  /// 與其他 slot 不同，它在網頁載入前就掛上，且整個殼存活期間都在。
  Widget? buildUnderlay(BuildContext context) => null;

  /// 疊在 WebView 之上的原生 UI；回傳 null 表示沒有。
  ///
  /// 位於啟動過場之下、WebView 之上。需要吃掉觸控的 UI 請自行用 `Positioned` 限定範圍，
  /// 否則會擋住下方的網頁。
  Widget? buildOverlay(BuildContext context) => null;

  /// 殼結束時呼叫，釋放資源。
  void dispose() {}
}
