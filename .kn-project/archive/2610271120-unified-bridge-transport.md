# 2610271120 - unified-bridge-transport

- Created: 2026-10-27 11:20 / Archived: 2026-10-27 16:00
- Issue: Aqutter/aqutter#20
- Milestone: N/A / Base Branch: main

## Summary
殼把內建與 plugin 的 handler 登錄到 `AqutterRpcHost`、事件改由它送出，網頁與殼之間只剩一條多工連線：`supportedPlatforms` 不支援時回 `UNSUPPORTED_PLATFORM`、handler 回傳 `aqutterErrorPayload` 轉成錯誤訊框，`AqutterPlugin.channels` 與 `openBinaryChannel` 移除（二進位直接放在酬載）。`callHandler` 只留給 `native_endpoint`；所有 App 的 CSP 都需允許 `ws://127.0.0.1:*`。開發介面不變，既有 plugin 不需修改。

## Cross-Repo Scope
- 共用計畫 ID `2610271120-unified-bridge-transport`、共用分支名 `feature/2610281120-unified-bridge-transport`。
- `Aqutter/aqutter_core`（`#6`）：`AqutterRpcHost`——訊框編解碼、`aqutter.rpc` 通道、handler 登錄與分派、`emit`、自動分段。
- `Aqutter/aqutter`（`#20`，界接）：內建與 plugin handler 登錄到 `AqutterRpcHost`、`supportedPlatforms`、`aqutterError` 轉換、移除 `channels`；文件與基準。
- `Aqutter/aqutter-js`（`#6`）：傳輸模組（連線、排隊、重連）、訊框編解碼、`callFlutter`／`callPlugin`／事件改走新傳輸、`onTransportState`、移除 `openBinaryChannel`。
- 順序：`aqutter_core` → `aqutter` → `aqutter-js`（契約 rev 2 起，core 與 js 可平行）。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；三個 repo 皆不指定 milestone，base 為 `main`。
- **[方向]** 使用者要求擴充 plugin 與使用 Flutter⇄網頁通道時不要有太多選擇，因此合併成單一傳輸，不並存兩套 API；開發介面（`handlers`、`emit`、`callPlugin`、`onPluginEvent`）不變，二進位直接放進酬載。
- **[分層]** Dart 端程式碼與介面由 `aqutter_core` 提供，`aqutter` 只做界接。
- **[Q1]** 內建 handler 全部改走新傳輸，只留 `native_endpoint` 在 `callHandler`。
- **[Q2]** Linux 由 agent 以 WSL2 驗證；iOS、macOS 由使用者用 Mac 驗證（追蹤於 Aqutter/aqutter#21）；失敗的處理屆時再決定，不預設也不排除全面統一。
- **[Q3]** 重連期間的事件不補發，提供 `onTransportState`。
- **[Q4]** 呼叫不設預設逾時；連線關閉時已送出的呼叫以 `TRANSPORT_CLOSED` 失敗。
- **[Q5]** 單一 WebSocket 訊息上限 64 MiB（rev 1）。
- **[契約變更]** rev 1 → 2：新增 `part` 訊框與自動分段，邏輯訊框上限 512 MiB（使用者要求框架自動處理大資料，2026-10-27 核准）。
- **[執行模式]** 序列。
- **[執行中]** 新連線到來時舊連線以 1000 關閉（最後一條有效）；訊框超過上限以 1009、格式錯誤以 1002 關閉——補上契約未指定的細節。
- **[完成後]** commit + 開 PR（併回 `main`）。

## Deviations
- 計畫 ID 與日期更正：原 `2610281120`（誤用 2026-10-28，機器日期是 2026-10-27）更正為 `2610271120`；GitHub 上實際存在過的分支名（`feature/2610281120-unified-bridge-transport`）、PR 與 issue 留言維持原樣。
- 契約 rev 1 → rev 2：殼端沒有程式碼變更，只更新文件（自動分段、512 MiB）。
- `aqutterPluginChannelName` 等通道輔助函式在上一份計畫加入、本計畫移除。
- 範本專案（三個 plugin：battery、haptics、mirror-demo）在 Android 實機驗證過；plugin 的 Dart 部分在暫存目錄改用本機殼路徑建置（沒有改動正式專案與 plugin repo），合併、移動 tag 後仍需用 `aqutter upgrade` 實際走一次。
- Windows、Linux 小呼叫延遲比改版前高（Windows 約 +0.3 ms，WSL2 Linux 3.6 ms 但無改版前對照）；iOS、macOS 未驗證（#21）。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart`（`_handle`、`register`、`_registerNative`、`_registerPlugins`、`_PluginContext`）— 登錄到 `AqutterRpcHost`，`native_endpoint` 維持 `callHandler`，保留 id `aqutter`。
- `shell/lib/src/bridge/bridge_emitter.dart` — 轉呼叫 `AqutterRpcHost.emit`。
- `shell/lib/src/app.dart` — 移除 controller 注入。
- `shell/lib/src/plugin/aqutter_plugin.dart`、`shell/lib/aqutter.dart` — 移除 `channels` 與輔助函式，新增 `aqutterErrorOf`、`aqutterReservedPluginId`，匯出 `AqutterRpcException`。
- `shell/pubspec.yaml` — `aqutter_core` 依賴（合併、移動 tag 後回到 tag）。
- `shell/test/plugin_test.dart` — `aqutterErrorOf`、保留 id。
- `docs/plugins.md`、`docs/channel-performance.md`、`docs/nativeview.md`、`tools/channel-bench/**`、`.kn-project/project.md`、`.kn-project/wiki/platform/architecture.md` — 文件、基準與量測結果（Android、Windows、Linux）。

## Details
- 驗證：`flutter analyze` 乾淨、`flutter test` 93 個全過；Android、Windows、Linux（WSL2）端對端通過（結果檔在 `tools/channel-bench/results/`）。

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/architecture.md` | 2026-10-27 | — | 網頁與殼之間統一成一條多工連線 | [#20](https://github.com/Aqutter/aqutter/issues/20) | — |
