# Plan: 2611171140 - map-passthrough-spike
- Created: 2026-11-17
- Branch: feature/2611171140-map-passthrough-spike
- Issue: Aqutter/aqutter#67
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
驗證「方案 2」：Android 上的原生 Google 地圖不再鏡像到網頁 canvas，改為直接畫在 Flutter 裡、放在**透明的 WebView 下面**，網頁的 HTML 疊在地圖之上。本計畫只做驗證，**不併入主幹**；結論寫成驗證報告，通過後另開正式計畫。

本 repo（殼）負責：讓 WebView 背景可以透明（實驗開關）。地圖 plugin 那一半在 `aqutter-plugins`。

## Architecture
- 現況：`AqutterApp` 的 Stack 先放 plugin 的 `buildUnderlay`、再放 `AqutterWebView`（`shell/lib/src/app.dart:903-905`）。WebView 背景不透明，所以地圖被蓋住，plugin 才用 `AqutterNative` 把畫面鏡像給網頁。
- 實驗：以 `--dart-define=AQUTTER_WEBVIEW_TRANSPARENT=true` 讓 `AqutterWebViewSettings.transparentBackground` 為 true（核心已支援，`aqutter_core/lib/src/platform_interface/src/webview/webview_settings.dart:3829`、Android 實作 `aqutter_core/android/src/main/kotlin/com/github/aqutter/core/webview/webview/AqutterWebView.kt:364`）。預設 false，行為與現況完全相同。
- 網頁端要把 `html`、`body` 與地圖容器的背景設成透明，地圖才看得到。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611171140-map-passthrough-spike`　**共用分支名**: `feature/2611171140-map-passthrough-spike`
- **參與 repo 與職責**:
  - `aqutter` — 提供透明 WebView 的實驗開關　issue: `Aqutter/aqutter#67`
  - `aqutter-plugins` — 地圖 plugin 的「不鏡像」模式、網頁端手勢轉送、效能量測、驗證報告　issue: `Aqutter/aqutter-plugins#7`
- **執行順序相依**: aqutter（開關）先，aqutter-plugins 後；兩者在 nuxt-app 以本機路徑覆寫串起來，不改 nuxt-app 的提交內容。
- **跨 repo 檔案指涉**: 無

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-17）`

實驗性質，只有兩個編譯期鍵，不是對外 API：

| 鍵 | 讀取者 | 值 | 預設 | 作用 |
|---|---|---|---|---|
| `AQUTTER_WEBVIEW_TRANSPARENT` | 殼（`aqutter`） | `true` / `false` | `false` | `true` 時 WebView 背景透明 |
| `AQUTTER_MAP_PASSTHROUGH` | 地圖 plugin（`aqutter-plugins`） | `true` / `false` | `false` | `true` 時地圖不鏡像，直接畫在 WebView 下面 |

- 兩個鍵必須同時為 `true` 才有意義；只開 plugin 的鍵，地圖會被不透明的 WebView 蓋住。
- 相容性：兩者預設 `false`，不影響任何既有 App。
- 變更紀錄：_(尚無)_

## Impact Files
- `shell/lib/src/app.dart:952` (`_buildWebView` 的 `initialSettings`) — 加入 `transparentBackground`，值取自 `AQUTTER_WEBVIEW_TRANSPARENT`（預設 false）。

## App-Flow Screens
（無 app-flow.json，刪除）

## Open Questions / 待確認事項
### Q1. 地圖區域的觸控怎麼交給地圖？— 影響範圍：aqutter-plugins（本 repo 不受影響）
- [x] 選項 A：網頁自己監聽 pointer 事件，換成 pan／pinch／doubleTap 語意手勢，經 `callPlugin` 送給 plugin，沿用現有 `AqutterMapGestureMapper`　(建議，理由：不動 aqutter_core 與 aqutter-js，驗證成本最低，也最接近正式版會做的事)
- [ ] 選項 B：沿用 `<aqutter-native>` 但關掉影格串流，只保留手勢　(需改 aqutter_core 與 aqutter-js，範圍太大)
- **決議**：選項 A　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
無 — 本計畫只動殼的一個實驗開關，沒有 migration、env 鍵對外發佈、部署或第三方主控台設定。（新增的兩個 `dart-define` 鍵是實驗性質，沒有同步到 `aqutter-cli` 範本與 `docs/environment.md`；若日後採用，須依 AGENTS.md 第 3 條三處成對。）

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-plugins`（依據：`shell/lib/src/app.dart:903`、`aqutter-plugins/packages/google-maps/lib/src/google_maps_plugin.dart:161`）；使用者確認走「實驗分支，不併入主幹」。
- **[Milestone]** 不指定，以 `main` 為 base — 使用者於 Phase 0 選擇；本 repo 開發階段不開 milestone 與版本分支。
- **[Q1]** 觸控由網頁監聽 pointer 轉語意手勢，經 `callPlugin` 送 plugin — 理由：不動 aqutter_core 與 aqutter-js，驗證成本最低。
- **[範圍]** 只驗證 Android（ASUS I006D、Android 13、API 33，adb 序號 `M4AIB763K212ZBA`）；iOS 沒有設備，列為未驗證。
- **[契約]** rev 1 凍結（核准日 2026-11-17）。
- **[執行模式]** 序列（依據：plugin 的實測依賴殼的開關，且只有一支實機；先 aqutter 後 aqutter-plugins）。
- **[完成後]** commit + push（實驗分支，不歸檔、不開 PR）；驗證完成後再與使用者決定去留。

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base（若最後要開 PR）。
- Issue 綁定時，每個 commit 訊息都含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`）。
- 這是實驗分支，預計**不併入主幹**；完成後的動作見核准閘。

## References
- 前一輪討論：鏡像 google map 的替代方案（方案 2 = 透明洞穿透）。
