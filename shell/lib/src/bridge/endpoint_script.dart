import 'dart:convert';

import 'package:aqutter_core/aqutter_core.dart';

/// 端點注入腳本所屬的群組名稱：端點變更時以它整組移除舊腳本。
const String aqutterEndpointScriptGroup = 'aqutter-endpoint';

/// 定義網頁端的 `window.aqutterEndpoint`（`{ port, token }`，已凍結）。
///
/// 腳本形式是介面契約的一部分（`aqutter-js` 的 client 靠它判斷是否在殼內、並取得連線資訊）：
/// `writable: false` 但 `configurable: true`，殼才能在伺服器重啟後以 `evaluateJavascript` 重新定義。
/// 令牌以 JSON 字串輸出，不論內容為何都是合法的 JS 字串字面值。
String buildEndpointScript(AqutterNativeEndpoint endpoint) =>
    'Object.defineProperty(window,"aqutterEndpoint",{value:Object.freeze({port:${endpoint.port},token:${jsonEncode(endpoint.token)}}),configurable:true,enumerable:false,writable:false});';

/// 頁面載入時注入端點的 [AqutterUserScript]：早於頁面腳本、只注入主框架。
AqutterUserScript buildEndpointUserScript(AqutterNativeEndpoint endpoint) => AqutterUserScript(
      groupName: aqutterEndpointScriptGroup,
      source: buildEndpointScript(endpoint),
      injectionTime: AqutterUserScriptInjectionTime.AT_DOCUMENT_START,
      forMainFrameOnly: true,
    );
