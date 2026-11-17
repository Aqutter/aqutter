# Tasks for 2611171503

## Phase 1 — 殼的透明切換
- [x] [aqutter] 需等待 [aqutter_core]：`passthroughSessions` 與透明行為保證完成
- [x] [aqutter] `app.dart` 訂閱 `passthroughSessions`，切換 WebView 透明；重掛時套用；測試
- [x] [aqutter] `cd shell && flutter analyze && flutter test`

## Phase 2 — 文件與實機
- [x] [aqutter] 文件補穿透模式的頁面條件
- [x] [aqutter] 需等待 [aqutter_core]、[aqutter-js]：Android 實機跑 nuxt-app 地圖頁，確認進入地圖頁才透明、離開恢復
