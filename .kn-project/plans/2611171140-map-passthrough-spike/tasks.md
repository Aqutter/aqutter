# Tasks for 2611171140

## Phase 1 — 殼的實驗開關
- [x] [aqutter] `app.dart:952` 的 `initialSettings` 加 `transparentBackground`，取自 `AQUTTER_WEBVIEW_TRANSPARENT`（預設 false）
- [x] [aqutter] `cd shell && flutter analyze && flutter test`

## Phase 2 — 交給 aqutter-plugins 驗證
- [ ] [aqutter] 需等待 [aqutter-plugins]：不鏡像模式與網頁端完成
- [ ] [aqutter] 在 nuxt-app 以本機路徑覆寫殼，帶兩個 dart-define 鍵跑到 ASUS 實機，確認 WebView 真的透明
