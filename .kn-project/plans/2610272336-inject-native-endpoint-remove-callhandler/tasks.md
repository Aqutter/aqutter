# Tasks for 2610272336

## Phase 1 — 驗證注入可行性（Phase 3 第一步，失敗就停下回報）
- [ ] [aqutter] 小型驗證：`initialUserScripts` 的 `AT_DOCUMENT_START` 腳本是否早於頁面腳本，且不被核心橋接腳本（`window.aqutter = {}`）影響；`addUserScript`／`removeUserScript`／`evaluateJavascript` 在目前支援的平台行為一致　需等待 [aqutter_core]：契約 #1 已可用

## Phase 2 — 殼端實作（契約 #2 的提供方）
- [x] [aqutter] `shell/lib/src/bridge/endpoint_script.dart` (new)：`buildEndpointUserScript`　依賴 Contract §2 #2
- [x] [aqutter] `app.dart`：建立 WebView 前 `await ensureStarted()`，`initialUserScripts` 放入端點腳本；`_webViewGeneration` 重掛時用最新端點
- [x] [aqutter] `app.dart` `_onWebViewCreated`：訂閱 `AqutterNativeHost.instance.endpoint`，變更時更新頁面（`evaluateJavascript`）與注入腳本；`dispose` 取消訂閱
- [x] [aqutter] `bridge_registry.dart`：移除 `_registerNative` 與 `_capabilities.add(nativeEndpoint)`，調整 `register` 簽章與呼叫端
- [x] [aqutter] `bridge_names.dart:16`：移除 `nativeEndpoint`　可平行（與 [aqutter-js] 成對）

- [x] [aqutter] 補列：`docs/nativeview.md:67` 範例、`.kn-project/project.md:25`　依賴 Contract §1 #4

## Phase 3 — 測試與清理
- [x] [aqutter] `shell/test/endpoint_script_test.dart` (new)
- [x] [aqutter] `tools/channel-bench/app/bench_plugin.dart` 過時註解
- [x] [demo-app，非治理範圍] 備份後刪除 `dbltest.html`（Q2 已確認；備份到暫存區，不進任何 repo）
- [x] [aqutter] `flutter analyze && flutter test`（`cd shell`）

## Phase 4 — 整合驗證
- [ ] [aqutter] 以實機（iPad、Android 手機）與 macOS 跑 `aqutter-nuxt-app`／`demo-app`：頁面載入後傳輸連得上；`restart()` 後恢復　需等待 [aqutter-js]：client 改讀 `window.aqutterEndpoint` 並通過其測試
