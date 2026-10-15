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
///   - 以 [buildOverlay] 在 WebView 之上掛原生 Flutter UI
///   - 自由相依其他 Flutter plugin（例如 battery_plus），其原生部分由 Flutter 工具鏈照常整合
abstract class AqutterPlugin {
  /// plugin 識別字，須符合 [aqutterPluginIdPattern]，並與網頁端套件使用的 id 一致。
  String get id;

  /// 暴露給網頁的方法，鍵為方法名（不含 id 前綴）。
  Map<String, AqutterPluginHandler> get handlers => const {};

  /// 殼就緒後呼叫一次；[context] 在 plugin 存活期間有效。
  void attach(AqutterPluginContext context) {}

  /// 疊在 WebView 之上的原生 UI；回傳 null 表示沒有。
  ///
  /// 位於啟動過場之下、WebView 之上。需要吃掉觸控的 UI 請自行用 `Positioned` 限定範圍，
  /// 否則會擋住下方的網頁。
  Widget? buildOverlay(BuildContext context) => null;

  /// 殼結束時呼叫，釋放資源。
  void dispose() {}
}
