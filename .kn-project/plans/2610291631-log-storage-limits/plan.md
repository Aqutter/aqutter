<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610291631 - log-storage-limits
- Created: 2026-10-29
- Branch: N/A（直接 main，已確認）
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A（未指定；project.md 開發階段不開 milestone）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
讓 App 不會因為殼自動產生的檔案而越來越大，並允許完全不要這些檔案：(1) `runAqutter` 新增開關，可關閉「待送錯誤紀錄」的落檔（錯誤仍可派給 `AqutterErrorReporter`）；(2) 殼的預設日誌目錄（內部警告、`useAppLog` 預設位置）加上保留天數與總容量上限，超過就刪最舊的檔案。網頁指定的其他位置（`target`）不在清理範圍。

## Architecture
- `ErrorCenter` 的 `spool` 改為可空：為 `null` 時不落檔，`take()` 回傳空、錯誤仍派給 reporters；`runAqutter(crashSpool: false)` 傳入 `null`。
- 新增 `LogRetention`（`maxAge`、`maxBytes`，皆可為 `null`＝不限）放進 `AqutterConfig.logRetention`，經 `BridgeRegistry` 傳給 `LogService`。
- `LogService` 只清理預設日誌目錄：啟動時一次，之後在「建立當日新檔」時再清理一次（不加排程、不在每次寫入掃描）；先刪超過 `maxAge` 的，再依修改時間由舊到新刪到總容量不超過 `maxBytes`，永遠保留今天的檔案。
- 單一 repo、單一層、無線上格式變更。

## Cross-Repo Scope
無（單一 repo）。

## Contract / 介面契約
無（單一 repo，僅 Dart 公開 API 新增選填參數；線上格式不變）。

## Impact Files
- `shell/lib/src/app.dart:45` (`runAqutter`) — 新增 `crashSpool` 參數；`:67` (`_createErrorCenter`) 依開關建立 spool；`:333` (`BridgeRegistry(` 建立處) 傳入 `logRetention`
- `shell/lib/src/error/error_center.dart` (`ErrorCenter`) — `spool` 可空；`record`／`take`／`ack` 對空 spool 安全
- `shell/lib/src/aqutter_config.dart:10` (`AqutterConfig`) — 新增 `logRetention`
- `shell/lib/src/bridge/log_service.dart:182` (`append`) 與 `:17` (`_logDir`) 附近 — 清理邏輯
- `shell/lib/src/bridge/bridge_registry.dart:84` (`_log`) — 以設定建立 `LogService`
- `shell/lib/src/bridge/log_retention.dart` (new) — `LogRetention` 與清理規則（純函式，便於測試）
- `shell/lib/aqutter.dart:6` (exports) — 匯出 `LogRetention`
- `shell/test/log_retention_test.dart` (new)、`shell/test/error_center_test.dart` — 清理規則與關閉 spool 的行為
- `.kn-project/wiki/platform/log-file.md`、`.kn-project/wiki/platform/error-capture.md` — 規則表補上保留與開關（歸檔時處理）

## App-Flow Screens
（無 app-flow.json）

## Open Questions / 待確認事項
### Q1. `logRetention` 的預設值 — 影響範圍：`AqutterConfig`、所有既有 App 的行為
- [ ] 預設不限制（`null`），App 自行設定　(保守：不改變既有行為，但不設定就仍會無限增長)
- [x] 預設 14 天、20 MiB
- **決議**：已確認　狀態：✅ 已確認

### Q2. 版控與 issue 流程 — 影響範圍：流程
- [ ] 直接 main、不建 issue　(建議，符合 project.md)
- [ ] 直接 main、建一張 issue
- **決議**：已確認　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
- **[上線前]** 實機確認舊檔會被清理：在手機預設日誌目錄放入超過保留天數的舊檔，重啟 App 後確認被刪 — 以 `adb` 調整檔案時間後檢查（release 版讀不到內部目錄，需 debug 版 `run-as`）— agent 沒有 debug 版安裝與長時間觀察的條件

## Key Decisions
- **[範圍]** 只清理預設日誌目錄；網頁指定的 `target` 位置、待送錯誤紀錄不在保留策略內（待送紀錄已有 50 筆上限）— 理由：網頁自行決定的位置由網頁自行管理；避免殼誤刪使用者要保留的檔案。
- **[時機]** 啟動時與建立當日新檔時清理，不加排程 — 理由：沿用「不需要排程、寫入當下才知道」的設計。
- **[保護]** 永遠保留今天的檔案 — 理由：避免正在寫入的檔案被刪。
- **[關閉 spool]** 關閉時錯誤仍派給 reporter — 理由：Crashlytics 等接口不應因不落檔而失效。

## Git Completion Policy
- 開發階段直接推送 `main`；commit 自動；不開 PR；歸檔依 Rule 13。

## References
- 上一個計畫：`2610291528-crash-error-capture`（待送錯誤紀錄）、`2610291408-console-file-logging`（日誌檔）。
- **[Q1]** 預設 14 天、20 MiB — 理由：使用者在意檔案越來越大；App 可用 logRetention 覆寫或設為不限（使用者於核准閘選定）。
- **[Q2]** 直接 main、不建 issue；完成後只 commit。
- **[執行模式]** 序列（單一 repo）。
- **[順手]** LogService 預設目錄改走可注入的根目錄解析，才能測試預設位置（含換日清理）；行為不變。
