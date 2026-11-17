# 2611171503-native-passthrough-mode

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter#68
- Milestone: N/A / Base Branch: main

## Summary
殼讓 WebView 只在有穿透中的 `AqutterNative` 工作階段時透明，沒有時還原，穿透模式的原生內容才能從 WebView 下面透出來，且啟動與沒有穿透的畫面不會露出底層。
新增 `WebViewTransparency`（依 core 的 `passthroughSessions` 切換、一次一個套用、失敗只通知一次並讓 core 之後的協商退回鏡像），`app.dart` 建立 WebView 時就帶初始透明；另重新匯出 `AqutterNativeMode`。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611171503-native-passthrough-mode`　**共用分支名**: `feature/2611171503-native-passthrough-mode`
- **參與 repo 與職責**（一 repo 一 issue，尚未建立時寫 `待建立`）:
  - `aqutter_core` — 契約正本；協定的原生端、`AqutterNative` widget、`passthroughSessions`、Android WebView 透明的行為保證　issue: `Aqutter/aqutter_core#31`
  - `aqutter-js` — 標籤的 `mode` 屬性、模式協商、頁面可穿透偵測、`layout` 追蹤、`aqutter-mode` 事件　issue: `Aqutter/aqutter-js#14`
  - `aqutter` — 殼：監聽 `passthroughSessions` 切換 WebView 透明　issue: `Aqutter/aqutter#68`
  - `aqutter-plugins` — google-maps 等 plugin 沿用同一個標籤與 `AqutterNative`，加上 `mode` 選項、文件　issue: `Aqutter/aqutter-plugins#8`
- **執行順序相依**: `aqutter_core`（協定與 Dart 端）先；`aqutter-js` 在契約凍結後可與 core **平行**（兩端以契約為準，整合驗證需等兩邊都完成）；`aqutter`（殼）與 `aqutter-plugins` 需等待 `aqutter_core` 的 `passthroughSessions` 與透明行為保證完成，plugin 另需等待 `aqutter-js`。
- **跨 repo 檔案指涉**: 無（各 repo 的檔案只列在自己的 `## Impact Files`）。
- **合併後的連動**: 各 repo 合併後，`aqutter` 的 `manifest/releases.json`（`core.ref`、`shell.ref`、`client.spec`）與 `aqutter-cli` 的 manifest 快照需重新同步，0.0.0 tag 需移動，見各份 `## Manual Follow-ups`。
- **契約**：正本 `aqutter_core`，最終 rev 2；介面共 9 項（`mode` 屬性、`mode` 請求與回覆、`layout`、手勢訊息不變、`AqutterNative(mode:)`、`passthroughSessions`、`aqutter-mode` 事件、WebView 透明的行為保證）；全文在 aqutter_core 的 archive 與 PR 說明。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter_core`、`aqutter-js`、`aqutter`、`aqutter-plugins`（依據：鏡像實作在 `aqutter_core/lib/src/nativeview/` 與 `aqutter-js/src/nativeview/`；殼的底層與 WebView 在 `aqutter/shell/lib/src/app.dart`；使用端在 `aqutter-plugins/packages/google-maps`）。`aqutter-cli`、`aqutter-nuxt-app` 不在本次範圍（只有合併後的鎖定同步）。
- **[Milestone]** 四個 repo 皆不指定，以 `main` 為 base — 使用者於 Phase 0 選擇。
- **[Q1]** 預設 `mode` 為 `auto` — 使用者決議；已知會改變既有 Android App 的行為，以 `pageReady` 偵測降低風險（契約 §5）。
- **[Q2]** iOS 的 `auto` 先視為不支援 — 理由：沒有 iOS 設備，未驗證。
- **[設計]** 模式決策只在原生端；網頁只回報 `pageReady`。 — 理由：兩端各自決策會不一致。
- **[設計]** 手勢座標維持相對元素 0..1。 — 理由：plugin 的手勢處理不需修改；穿透時原生端以元素大小的 child 承接。
- **[設計]** 底層原生內容與元素同大、同位置（不是螢幕大小）。 — 理由：前置實驗證實螢幕大小的地圖在元素一開始在螢幕外時，捲進來會是空白。
- **[設計]** 殼的 WebView 透明依 `passthroughSessions` 動態切換，不是全域常開。 — 理由：避免啟動時與其他畫面露出底層。
- **[前置實驗]** 透明的初始設定在 Android 不生效（兩段式才生效），列為 aqutter_core 要查根因的工作，不在殼繞過。
- **[程式碼風格]** 實作遵守 `kn-project-code-style`。
- **[契約]** rev 1 凍結（核准日 2026-11-17）。
- **[契約變更]** rev 1 → rev 2（已核准）：child 一律保持掛載，穿透時第一則可見 layout 前以 `Offstage` 隱藏（契約 §4、§6）；只影響 aqutter_core 的實作，本 repo 只同步契約文字。
- **[實作]** `WebViewTransparency`（新檔）負責切換：一次只做一個套用、套用完再比對最新需求、失敗只通知一次並停止重試（下一個 WebView 掛上才重來）；失敗時 `AqutterNativeHost.instance.passthroughAvailable = false`。
- **[實作]** WebView 建立時就以目前需求當初始透明（`_transparencyGeneration` 記錄這一代的初始值），之後只補差異；WebView 重掛前先 `detach()`。
- **[實作]** 執行期改透明用 `setSettings` 時傳**整份**設定（與建立時同一個 `_webViewSettings`），不是只傳 `transparentBackground`：Android 端會把整份新設定套上去，只傳一個欄位會把 `keyboardAvoidance`、`supportZoom` 等重設成預設值。前置實驗的做法（只傳一個欄位）有這個副作用。
- **[依賴]** 殼編譯需要 core 的 `passthroughSessions` 與 `passthroughAvailable`；殼的 `pubspec.yaml` 以 tag `0.0.0` 依賴 core，所以 core 合併並移動 tag 後殼才能用 CI 編譯。開發期以未提交的 `shell/pubspec_overrides.yaml` 指向本機 core。
- **[驗證]** Android 實機（ASUS，API 33），殼**不帶任何透明旗標**，搭配本機 core 與 aqutter-js、未修改的 google-maps plugin：首頁正常不透明；進入地圖頁（協商成穿透）WebView 透明、地圖從洞透出；回首頁還原不透明、元素為 0；再進地圖頁仍正常。沒有出現 `failed to change the WebView transparency`。另以「滾動內容」版面驗證 core 的實作：卡片一開始在螢幕外，捲進來後地圖完整覆蓋、標記在卡片中心，滾動時地圖跟著卡片走。
- **[Impact Files 補列]** 實作 aqutter-plugins 時發現殼的公開匯出沒有 `AqutterNativeMode`，補列 `shell/lib/aqutter.dart` 並於使用者核准後加入（只加一個符號）。
- **[完成後]** commit + 開 PR（Rule 12 非互動鏈；完成前自動 fetch 後 rebase origin/main 並 push --force-with-lease --force-if-includes）。
- **[執行模式]** 序列（依據：環境只有單一 agent，沒有獨立子 agent）；順序 aqutter_core → aqutter-js → aqutter → aqutter-plugins。
- **[範圍]** 使用者指示「先定契約」：本次先把契約凍結、建立 issue 與分支並提交計畫，實作（`tasks.md` 的 Phase 1 起）等使用者確認後再開始。

## Deviations
- **契約 rev 1 → rev 2**：只同步契約文字，殼的程式不受影響。
- **Impact Files 補列（已重新核准）**：`shell/lib/aqutter.dart` 加入 `AqutterNativeMode` 匯出——plugin 只依賴殼，匯出清單逐項列舉，沒有它 plugin 無法使用 `AqutterNative(mode:)`。
- **文件改放 `docs/nativeview.md`**（計畫原寫 `docs/native-features.md` 或對應文件）：後者不涵蓋鏡像，前者才是對應文件。
- **執行期改透明傳整份設定**（計畫未寫）：Android 端會把整份新設定套到執行中的 WebView，只傳 `transparentBackground` 會把 `keyboardAvoidance`、`supportZoom` 等重設成預設值，所以建立時與執行期共用同一個 `_webViewSettings`。
- **殼要等 core 合併並移動 0.0.0 tag 後才能在 CI 編譯**：殼以 tag 依賴 core，需要 core 的 `passthroughSessions` 與 `passthroughAvailable`；開發期以未提交的 `shell/pubspec_overrides.yaml` 指向本機 core。
- **Wiki**：更新 `platform/architecture.md` 的跨層約定列，新增 `platform/webview-transparency.md`。
- 實機驗證只在 Android。

## Impact Files
- `shell/lib/src/app.dart:766` (`_onWebViewCreated`)、`:940` (`_buildWebView`)、`:903` (底層 `Stack`) — 訂閱 `passthroughSessions` 並切換 WebView 透明；WebView 重掛（`_webViewGeneration`）時套用目前值；dispose 時取消訂閱。
- `shell/test/` — 補透明切換的 widget 測試（以假的 `passthroughSessions` 驅動）。具體檔名於實作時依現有測試結構決定。
- `docs/nativeview.md` — 補「穿透模式」章節（對應文件：`docs/native-features.md` 不涵蓋鏡像，`docs/nativeview.md` 才是）。
- `shell/lib/aqutter.dart:36-46` (`export 'package:aqutter_core/aqutter_core.dart' show …`) — [補列] 加入 `AqutterNativeMode`：plugin 只依賴殼，匯出清單逐項列舉，沒有它 plugin 無法使用 `AqutterNative(mode:)`。
- `shell/lib/src/webview_transparency.dart` (new) — 依 `passthroughSessions` 切換 WebView 透明的控制器（純邏輯，方便測試）。
- `shell/test/webview_transparency_test.dart` (new) — 控制器的單元測試。

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/architecture.md` | 2026-11-17 | — | 穿透時才讓 WebView 透明；新增 WebView 透明頁並更新跨層約定 | [#68](https://github.com/Aqutter/aqutter/issues/68) | — |
| `platform/webview-transparency.md` | 2026-11-17 | — | 建立 | [#68](https://github.com/Aqutter/aqutter/issues/68) | — |
