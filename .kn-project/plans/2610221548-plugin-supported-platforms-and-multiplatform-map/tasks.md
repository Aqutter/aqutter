# Tasks for 2610221548

## Phase 1 — 驗證前提（契約第 3 點）
- [ ] 實測：plugin handler 回傳錯誤時，網頁端 `callPlugin` 的 Promise 是否 reject（不是卡住）；結果記入 plan 的 Key Decisions

## Phase 2 — 殼
- [ ] `AqutterPlugin.supportedPlatforms`（預設 null）
- [ ] `_registerPlugins` 依平台註冊：`supported`、不呼叫 `attach`、handler 回 `UNSUPPORTED_PLATFORM`
- [ ] `app.dart` 的 underlay／overlay 迴圈略過不支援的 plugin
- [ ] `shell/test/plugin_test.dart` 新增案例

## Phase 3 — 文件與驗證
- [ ] `docs/plugins.md`
- [ ] `flutter analyze`、`flutter test`
- [ ] wiki lint／build（有改 docs 時）
