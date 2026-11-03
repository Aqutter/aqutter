# Tasks for 2611031330

## Phase 1 — 殼
- [x] [aqutter] `AqutterPlugin.internal` 與 `AqutterPluginContext.callPlugin`（Contract §1 #2 #3）　可平行
- [x] [aqutter] `_registerPlugins` 跳過 internal；`_PluginContext` 實作 `callPlugin`
- [x] [aqutter] `shell/test/plugin_test.dart` 補測試：internal 不註冊、不列 capabilities、callPlugin 的五種情況

## Phase 2 — 文件與版本
- [x] [aqutter] `docs/plugins.md` 補 `callPlugin`、`internal`、`requires`、單一版本規則
- [ ] [aqutter] `manifest/releases.json` 的 shell ref 指向本次 commit
- [ ] [aqutter] 移動 `0.0.0` tag（需使用者同意後強推）

## Phase 3 — 驗證
- [x] [aqutter] `cd shell && flutter analyze && flutter test`
