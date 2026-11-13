# Tasks for 2611131616

## Phase 1 — 判定邏輯
- [x] [aqutter] 新增 `AQUTTER_REQUIRE_APP_READY` 解析與「是否嚴格」純函式（Contract §2）　可平行
- [x] [aqutter] `_startReadyWindow` 只在嚴格模式啟動
- [x] [aqutter] `_onLoadStop` 非嚴格模式兩幀後觸發 `_onWebReady`
- [x] [aqutter] 更新 `bridge_registry.dart:347` 註解

## Phase 2 — 測試
- [x] [aqutter] 新增 `shell/test/app_ready_mode_test.dart`
- [x] [aqutter] `flutter analyze` 與 `flutter test`

## Phase 3 — 文件
- [x] [aqutter] `docs/environment.md`、`docs/getting-started.md`、`docs/hot-update.md`、`docs/env.example`
- [x] [aqutter] 確認 `docs/env.example` 與 aqutter-cli 範本該段逐字一致　需等待 [aqutter-cli]：範本已更新

## Phase 4 — 實機驗證
- [x] [aqutter] 以 `aqutter dev windows` 跑沒呼叫 `app_ready` 的頁面，確認過場自動收起
