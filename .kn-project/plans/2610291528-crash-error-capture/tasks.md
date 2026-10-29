# Tasks for 2610291528

## Phase 1 — 接口與 spool
- [x] [aqutter] `AqutterErrorReporter`／`AqutterErrorReport`、`CrashSpool`（Contract §2、§4）

## Phase 2 — 錯誤處理與交付
- [x] [aqutter] `installErrorHooks`、`runAqutter(errorReporters)`
- [x] [aqutter] `crash_reports` 事件、`crash_ack`／`error_report` handler、`_onWebReady` flush　需等待 [aqutter-js]：契約型別完成

## Phase 3 — 驗證與對齊
- [x] [aqutter] 測試、`flutter analyze`（僅檢查本次新增檔案）
- [x] [aqutter] `manifest/releases.json` 的 `client.spec` 更新　需等待 [aqutter-js]：已 push
