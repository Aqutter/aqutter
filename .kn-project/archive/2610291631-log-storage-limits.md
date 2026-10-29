# 2610291631-log-storage-limits

- Created: 2026-10-29 16:31 / Archived: 2026-10-29 16:45
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼的預設日誌目錄加上保留策略（預設 14 天、總容量 20 MiB，可調整或設為不限），並新增 runAqutter(crashSpool: false) 可關閉待送錯誤紀錄落檔。
目的是避免殼自動產生的檔案讓 App 越來越大，並允許完全不要這些檔案；只動 aqutter 殼，線上格式不變。

## Cross-Repo Scope
無（單一 repo）。

## Key Decisions
- **範圍**：只清理預設日誌目錄；網頁指定的 target 位置與待送錯誤紀錄（已有 50 筆上限）不在保留策略內 — 網頁自行決定的位置由網頁管理，避免殼誤刪。
- **時機**：首次寫入與每次建立當日新檔時清理，另在啟動時清理一次，不加排程 — 沿用「寫入當下才知道」的設計。
- **保護**：今天修改過的檔案永遠保留 — 避免刪到正在寫入的檔案。
- **預設值**：14 天、20 MiB（使用者選定）；App 可用 AqutterConfig.logRetention 覆寫或設為 LogRetention.unlimited。
- **關閉 spool**：錯誤仍派給 AqutterErrorReporter，只是不落檔、不推送給網頁 — Crashlytics 等接口不應因不落檔而失效。
- **順手**：LogService 預設目錄改走可注入的根目錄解析，才能測試預設位置；行為不變。
- **流程**：直接 main、不建 issue；完成後只 commit，之後依使用者要求 push 並移動 tag 0.0.0。

## Deviations
無。實機未驗證舊檔被清理（release 版讀不到 App 內部目錄），僅由單元測試涵蓋。

## Impact Files
- `shell/lib/src/app.dart:45`（runAqutter）、`:67`（_createErrorCenter）、`:333`（BridgeRegistry 建立）— crashSpool 開關、傳入 logRetention
- `shell/lib/src/error/error_center.dart` — spool 可空
- `shell/lib/src/aqutter_config.dart:10` — logRetention
- `shell/lib/src/bridge/log_service.dart` — prune、預設目錄走根目錄解析
- `shell/lib/src/bridge/bridge_registry.dart:84` — 以設定建立 LogService，啟動時清理
- `shell/lib/src/bridge/log_retention.dart`（new）— LogRetention 與 selectLogFilesToDelete
- `shell/lib/aqutter.dart:6` — 匯出 LogRetention
- `shell/test/log_retention_test.dart`（new）、`shell/test/error_center_test.dart`
- `.kn-project/wiki/platform/log-file.md`、`.kn-project/wiki/platform/error-capture.md` — 規則表同步

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/log-file.md` | 2026-10-29 | — | 預設日誌目錄保留策略與可關閉的待送錯誤紀錄 | — | — |
| `platform/error-capture.md` | 2026-10-29 | — | 預設日誌目錄保留策略與可關閉的待送錯誤紀錄 | — | — |
