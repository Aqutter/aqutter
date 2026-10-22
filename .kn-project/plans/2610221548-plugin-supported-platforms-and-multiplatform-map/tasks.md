# Tasks for 2610221548

## Phase 1 — 契約變更
- [x] 契約 rev 2（`aqutterError`）：兩個 repo 的契約區塊同步並重新核准

## Phase 2 — 殼
- [x] `AqutterPlugin.supportedPlatforms`（預設 null）
- [x] `_registerPlugins` 依平台註冊：`supported`、不呼叫 `attach`、handler 回 `UNSUPPORTED_PLATFORM`
- [x] `app.dart` 的 underlay／overlay 迴圈略過不支援的 plugin
- [x] `shell/test/plugin_test.dart` 新增案例

## Phase 3 — 文件與驗證
- [x] `docs/plugins.md`
- [x] `flutter analyze`、`flutter test`
- [x] wiki lint／build（有改 docs 時）
