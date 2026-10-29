<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610291408 - console-file-logging
- Created: 2026-10-29
- Branch: N/A（直接 main，已確認）
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A（未指定；project.md 開發階段不開 milestone）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
殼端支援 `log_append` 的 `target`：依 provider 解析根目錄、驗證 `dir`／`name`、追加寫入 `{根}/{dir}/{name}_{yyyyMMdd}.log`；缺省 `target` 行為不變。完成後把 manifest 的 `client.spec` 指到新的 aqutter-js sha。

## Architecture
`LogService.append` 增加選填 `LogTarget`（Dart 值物件）；新增純函式驗證與路徑組合，以便單元測試（不依賴 path_provider）。provider→目錄解析包在可注入的函式內（測試可替換）。`bridge_registry.dart` 的 `logAppend` handler 選讀 `payload['target']`。錯誤以訊息前綴 `log_invalid_target:`／`log_provider_unavailable:` 丟出，經既有 `_handle` 回傳給 JS。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2610291408-console-file-logging`　**共用分支名**: N/A（直接 main）
- **參與 repo 與職責**: `aqutter-js`（契約與 SDK）、`aqutter`（殼落地與驗證）、`aqutter-nuxt-app`（範例接線）；issue 皆 `待建立`
- **執行順序相依**: aqutter-js → aqutter（再更新 `manifest/releases.json` 的 `client.spec` 為 aqutter-js sha）→ aqutter-nuxt-app（`aqutter upgrade` 後接線）。
- **跨 repo 檔案指涉**: 見各自 Impact Files 之外的他 repo 檔案：`aqutter-js` 的 `src/contract/bridge.ts`、`src/console.ts`。

## Contract / 介面契約
- **契約正本 repo**: `aqutter-js`　**修訂號**: `rev 2`　**狀態**: `凍結（rev 2 核准日 2026-10-29）`

### 1. 介面
| # | 項目 | 說明 |
|---|---|---|
| 1 | bridge handler `log_append`（名稱不變） | 請求新增選填欄位 `target`；缺省時行為與現況完全相同（寫入 `internal` 的 `logs/` 目錄、檔名 key 取 `log_set_key` 設定值，預設 `app`） |
| 2 | JS API `installConsoleLog(options?)` | 於 `@aqutter/aqutter` 匯出；攔截 `console.debug/log/info/warn/error`，並新增 `console.to.{debug,log,info,warn,error}(target, ...args)`；回傳 `uninstall()` |
| 3 | JS API `isConsoleLogInstalled()` | 供 App 層避免重複寫檔（例如 nuxt-app 的 `useAppLog`） |
| 4 | JS API `setConsoleLogTarget(target)`（rev 2） | 執行中改變一般 `console.*` 的目標；`target` 同下方 `TargetSource`；未安裝時為 no-op |

### 2. 欄位
**`LogAppendRequest`**（`@aqutter/aqutter/contract`）
| 欄位 | 型別 | 必填 | 預設值 | 限制 | 序列化 |
|---|---|---|---|---|---|
| `level` | `LogLevel`（`debug`/`info`/`warn`/`error`） | 是 | 無 | 列舉 | 一律輸出 |
| `message` | `string` | 是 | 無 | 單筆 ≤ 64 KiB（JS 端截斷並加 `…[truncated]`） | 一律輸出 |
| `target` | `LogTarget` | 否 | 省略 | 見下 | 省略時不輸出 |

**`LogTarget`**
| 欄位 | 型別 | 預設值 | 限制 |
|---|---|---|---|
| `provider` | `LogProvider` | `internal` | 列舉：`internal`＝`getApplicationSupportDirectory()`（現況）、`documents`＝`getApplicationDocumentsDirectory()`、`cache`＝`getApplicationCacheDirectory()`、`temp`＝`getTemporaryDirectory()`、`external`＝`getExternalStorageDirectory()`（僅 Android；App 專屬外部目錄，不需權限） |
| `dir` | `string` | `logs` | 相對路徑、以 `/` 分段；每段 `[A-Za-z0-9._-]+` 且不得為 `.`／`..`；最多 8 段、總長 ≤ 128 |
| `name` | `string` | 目前的 log key（`log_set_key`，預設 `app`） | `[A-Za-z0-9._-]{1,64}` |

實際檔案：`{provider 根目錄}/{dir}/{name}_{yyyyMMdd}.log`（日期為本地時間，跨午夜換檔）。每行格式不變：`{ISO8601} [{level}] {message}\n`，追加寫入並 flush。

**`console.to.<level>(target, ...args)`**：`target` 為 `LogTarget`，或字串（等同 `{ name: 字串 }`）；`...args` 同原生 console，序列化規則：字串原樣、`Error` 取 `stack ?? message`、其他以 JSON（循環參照以 `[Circular]` 取代；失敗退回 `String(x)`），以單一空格連接；含換行時整筆仍為一行，換行以 `\n` 字面轉義。`console.to.log` 的層級為 `info`。

**`installConsoleLog(options)`**
| 欄位 | 型別 | 預設值 | 說明 |
|---|---|---|---|
| `devtools` | `boolean` | `true` | `false` 時**不呼叫**原生 console（release 不輸出到 devtools，避免額外負擔）；SDK 不判斷 dev／release，由 App 傳入（Nuxt：`import.meta.dev`） |
| `file` | `boolean \| { minLevel?: LogLevel }` | `true` | 是否經 bridge 寫檔；`minLevel` 預設 `debug` |
| `target` | `TargetSource` | `undefined`（走殼的預設位置） | 一般 `console.*` 使用的目標；可為物件或函式（rev 2） |

**`TargetSource`（rev 2）** ＝ `LogTarget | ((call: ConsoleLogCall) => LogTarget | undefined)`；`console.to.<level>` 的第一個參數 ＝ `TargetSource | string`。
- `ConsoleLogCall` ＝ `{ level: LogLevel, method: ConsoleMethod, time: Date }`。
- 函式在**每一筆 log 呼叫當下**（排入佇列之前、同步）求值，因此可依當下時間／狀態決定 provider、dir、name（例如換日換檔名、依使用者切目錄）。回傳 `undefined` ＝ 走殼的預設位置。
- 函式必須同步、不得呼叫 `console.*`（會遞迴）；丟出例外時：該筆改走預設位置，並以錯誤代碼 `log_target_error` 只提示一次。
- 殼端行為不變（線上格式仍是純 `LogTarget`，函式只存在於 JS 端）；殼本身仍在每次寫入時以當下日期組檔名，所以不傳 `name` 時換日由殼自動處理。

### 3. 錯誤
| 代碼（訊息前綴） | 觸發條件 | JS 端行為 |
|---|---|---|
| `log_invalid_target` | `dir`／`name` 不符限制 | 該筆不寫檔；每個代碼在每個頁面載入只向原生 console 提示一次 |
| `log_provider_unavailable` | provider 在本平台不可用（如非 Android 用 `external`、取不到目錄） | 同上；**不**自動改寫到其他 provider |

### 4. 狀態與規則
- 寫檔為 fire-and-forget，但同一頁面內以單一 Promise 鏈串行送出，保證順序；寫檔失敗永不丟出到呼叫端。
- 非 Flutter（`isFlutter()` 為 false）或 SSR：不寫檔；`devtools` 設定照常生效；SSR 下 `installConsoleLog` 為 no-op。
- `list/read/write/remove/dir` handler 維持只針對預設 `internal/logs`，不涵蓋 `target` 指到的其他位置（v1 範圍）。

### 5. 相容性
- 舊版 JS 不帶 `target` 的 `log_append` 行為不變；舊殼收到帶 `target` 的請求會忽略它並寫入預設位置（Dart 端以 `payload['target']` 選讀）。
- 新增 `LogProvider` 列舉與 `LogAppendRequest.target`，對既有消費方為純新增。

### 6. 變更紀錄
- 2026-10-29 rev 2（草擬）：新增 `TargetSource`（`target` 可為函式，每筆呼叫求值）、`setConsoleLogTarget`、錯誤代碼 `log_target_error`。原因：使用者需要在寫檔當下動態決定路徑／檔名（無排程可覆寫）。影響：僅 `aqutter-js`（API）；`aqutter` 殼與線上格式不變、`aqutter-nuxt-app` 無需改動。

## Impact Files
- `shell/lib/src/bridge/log_service.dart:46` (`append`) — 新增 `target` 參數；`:17` (`_logDir`) 旁新增 provider 解析與路徑驗證
- `shell/lib/src/bridge/bridge_registry.dart:380` (`BridgeHandler.logAppend` handler) — 選讀並轉換 `target`
- `shell/lib/src/bridge/bridge_names.dart:26` (`logAppend`) — 名稱不變，僅確認成對
- `shell/test/log_service_test.dart` (new) — 驗證、路徑組合、換檔、拒絕 `..`／絕對路徑／不可用 provider
- `manifest/releases.json:24` (`client.spec`) — aqutter-js 推送後更新為新 sha（並跑 manifest 檢查）

## Manual Follow-ups / 人工收尾事項
- **[上線前]** Android／iOS 實機驗證 `external`／`documents` 落檔位置 — 見 aqutter-js 計畫 — agent 無實機

## App-Flow Screens
（無 app-flow.json）

## Open Questions / 待確認事項
### Q1. 是否直接 commit 到 `main`（project.md 規定）並各建 issue？ — 影響範圍：流程
- [x] 直接 main、不建 issue　(建議)
- [ ] 直接 main、各建一張 issue
- **決議**：直接 main、不建 issue　狀態：✅ 已確認

## Key Decisions
- **[範圍]** 能力在 aqutter-js、nuxt-app 僅範例 — 理由：使用者明示。
- **[安全]** 路徑驗證以 Dart 端為最後防線（JS 端驗證僅為早期提示）— 理由：JS 內容不可信。

## Git Completion Policy
- 開發階段直接推送 `main`；commit 自動；不開 PR；歸檔依 Rule 13。
- 跨 repo 時各自 commit (Rule 19)。

## References
- `aqutter-js` 的同名計畫（契約正本）。
- **[Q1]** 直接 main、不建 issue — 理由：符合 project.md；使用者於核准閘選定。
- **[契約]** rev 1 凍結（2026-10-29）。
- **[完成後]** 只 commit（不 push、不 PR、不歸檔）— 理由：核准閘選項為直接 main、不開 PR；push 待使用者另行要求。
- **[Iteration／換日驗證]** 使用者要求確保換日有效（2026-10-29 核准）：`aqutter` 的 `LogService` 加可注入時鐘（預設行為不變）並補跨午夜測試；`aqutter-js` 補假時鐘跨午夜測試；實機以「每分鐘換檔名」的函式 target 驗證每筆求值。契約不動。
- **[執行模式]** 序列（依據：三 repo 相依成一條線，且無法確認可派出獨立子 agent）。

- **[契約]** rev 2 凍結（2026-10-29）：TargetSource 函式、setConsoleLogTarget、log_target_error；函式丟例外改走預設位置並提示一次（使用者核准）。
