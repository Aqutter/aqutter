# Plan: 2611031330 - plugin-requires-and-internal-call
- Created: 2026-11-03
- Branch: N/A（直接 main）
- Issue: N/A（無 issue 追蹤基準）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
讓 plugin A 能依賴並封裝 plugin B：
1. 殼提供 `AqutterPluginContext.callPlugin`，A 的 Dart handler 可直接呼叫已登記的 B。
2. plugin 可宣告 `internal`，殼不對網頁註冊其 handler，網頁（Host）只能透過 A 使用 B 的功能。
3. 文件說明 `requires`、`internal`、`callPlugin` 與「一個 App 每個 plugin 只有一個版本」。

## Architecture
- `internal` 是 `AqutterPlugin` 的 getter（預設 `false`）。`_registerPlugins` 對 internal plugin 不呼叫 `_handle`，所以網頁呼叫得到既有的 `HANDLER_NOT_FOUND`，也不列入 `capabilities`；`attach`、`buildUnderlay`、`buildOverlay`、`dispose` 照常。
- `callPlugin` 在 `_PluginContext` 實作：以 id 在 `_allPlugins` 找 plugin，檢查 `aqutterPluginSupportsMethod`，直接呼叫 `plugin.handlers[method]`，結果經 `aqutterErrorOf` 轉例外。不經網頁、不經 bridge。
- `requires` 由 CLI 消費，殼不讀描述檔。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611031330-plugin-requires-and-internal-call`　**共用分支名**: N/A（直接 main）
- **參與 repo 與職責**:
  - `aqutter` — 殼的 `internal`、`callPlugin` 與文件，契約正本　issue: N/A
  - `aqutter-cli` — `requires` 的解析、連帶登記、版本檢查、`doctor`　issue: N/A
- **執行順序相依**: 兩者彼此獨立，契約凍結後可平行；CLI 的 `doctor` 不需要新版殼。
- **跨 repo 檔案指涉**: `aqutter-cli` 的 `src/plugins.ts`、`src/commands/plugin.ts`、`src/commands/doctor.ts`。`aqutter-js` 不變（`client.spec` 不動）。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `草擬`

### 1. 介面
| # | 層 | 介面 | 提供方 | 消費方 |
|---|---|---|---|---|
| 1 | 描述檔 `aqutter-plugin.json` | 選填欄位 `requires: { "<npm 套件名>": "<semver 範圍>" }` | `aqutter-cli`（解析） | plugin 作者 |
| 2 | Dart `AqutterPlugin` | `bool get internal => false`；為 `true` 時殼**不**對網頁註冊其 handler、也不列入 `capabilities` | `aqutter`（殼） | plugin 作者 |
| 3 | Dart `AqutterPluginContext` | `Future<dynamic> callPlugin(String pluginId, String method, [Map<String, dynamic> payload = const {}])` | `aqutter`（殼） | 在 `attach` 取得 context 的 plugin |

### 2. 欄位與行為
**`requires`**（`aqutter-plugin.json`）
| 欄位 | 型別 | 必填 | 限制 | 說明 |
|---|---|---|---|---|
| `requires` | 物件 | 否 | 鍵為 npm 套件名，值為 semver 範圍字串 | 省略＝無相依；既有 plugin 行為完全不變 |

- `aqutter plugin add A` 時，對 `requires` 的每個鍵 B：B 尚未登記就以 A 的 `package.json` `dependencies[B]` 的來源安裝並登記；已登記則只檢查版本。
- 已安裝 B 的 `package.json` `version` 不滿足 A 的範圍時，`plugin add` 失敗並指出「A 要求 B `<範圍>`，已安裝 `<版本>`」；`aqutter doctor` 對已登記的 plugin 做同一項檢查，列為錯誤。
- `aqutter plugin remove B` 時若仍有已登記的 plugin 在 `requires` 它，拒絕並列出是誰（`--force` 才移除）。

**`callPlugin`**（Dart）
| 情況 | 行為 |
|---|---|
| 成功 | 回傳 handler 的結果（已 JSON 化的值） |
| 找不到 `pluginId` | 拋 `AqutterRpcException('PLUGIN_NOT_FOUND', …)` |
| 該 plugin 沒有 `method` | 拋 `AqutterRpcException('HANDLER_NOT_FOUND', …)` |
| 該方法在目前平台不支援（`supportedPlatformsFor`） | 拋 `AqutterRpcException(aqutterUnsupportedPlatform, …)`，不執行 handler |
| handler 回傳 `aqutterError` 資料 | 轉成 `AqutterRpcException`（同 `aqutterErrorOf`） |

- 被呼叫的 plugin 若為 `internal`，仍可被 `callPlugin` 呼叫；網頁直接呼叫 internal plugin 得到 `HANDLER_NOT_FOUND`，`callPlugin`（TS）依既有規則回 `undefined`。
- `internal` 的 plugin 仍會 `attach`、`buildUnderlay`、`buildOverlay`、`dispose`。

### 3. 錯誤碼
| 錯誤碼 | 觸發 | 呼叫端預期 |
|---|---|---|
| `PLUGIN_NOT_FOUND` | `callPlugin` 的 id 未登記 | A 應在 README 要求使用者登記 B；缺 B 時回報而非當機 |
| `HANDLER_NOT_FOUND` | 方法不存在，或網頁直呼 internal plugin | 同既有語意 |
| `UNSUPPORTED_PLATFORM` | 方法不支援目前平台 | 同既有語意 |

### 4. 狀態與規則
- 一個 App 內每個 plugin id 只有一個實例、一個版本（既有的重複 id 檢查不變）。
- `callPlugin` 同步轉呼叫，不經網頁、不經 bridge。
- 循環呼叫（A→B→A）的處理見 Open Questions Q5。

### 5. 相容性
- 不帶 `requires`、不覆寫 `internal` 的既有 plugin 與網頁端完全不受影響。
- 不改任何 bridge handler 名稱與 aqutter-js 契約，`client.spec` 不變。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `shell/lib/src/plugin/aqutter_plugin.dart:78` (`AqutterPluginContext`) — 新增 `callPlugin`
- `shell/lib/src/plugin/aqutter_plugin.dart:124` (`supportedPlatformsFor` 之後) — 新增 `internal` getter
- `shell/lib/src/bridge/bridge_registry.dart:198` (`_registerPlugins`) — internal plugin 不註冊網頁 handler
- `shell/lib/src/bridge/bridge_registry.dart:239` (`attach` 呼叫處)、`:877` (`_PluginContext`) — 傳入 plugin 查找並實作 `callPlugin`
- `shell/test/plugin_test.dart` — 新增 internal 與 callPlugin 的測試案例（既有 plugin 測試檔）
- `docs/plugins.md:146` (context 說明小節) — 補 `callPlugin`、`internal`，新增「相依其他 plugin」小節（`requires`、單一版本規則、循環呼叫）
- `manifest/releases.json` — shell ref 更新為本次 commit

## Open Questions / 待確認事項
> 全部釐清前不得進入 Phase 3。

### Q1. B 對 Host 隱藏的做法 — 影響範圍：殼、CLI、文件
- [x] Dart 端 A 呼叫 B：新增 `context.callPlugin`，B 標 `internal`，殼不對網頁註冊 B　(建議)
- [ ] 只做型別與文件約定
- [ ] 本輪不做
- **決議**：Dart 端 A 呼叫 B　狀態：✅ 已確認

### Q2. `requires` 格式 — 影響範圍：描述檔、CLI
- [x] 套件名加 semver 範圍（物件）　(建議，理由：連帶登記與版本相容檢查都需要範圍)
- [ ] 只寫套件名陣列
- **決議**：套件名加版本範圍　狀態：✅ 已確認

### Q3. 連帶安裝 B 的來源 — 影響範圍：`aqutter-cli` 的 `plugin add`
- [x] 取 A 的 `package.json` `dependencies[B]` 的來源，以 App 直接依賴安裝　(建議，理由：App 的 pubspec 用 `node_modules/<npm>` 路徑，pnpm 不會把 A 的間接依賴提升到根目錄，所以 B 必須成為 App 的直接依賴)
- [ ] 要求使用者先自行 `plugin add B`，CLI 只檢查並報錯
- **決議**：取 A 的 `dependencies`　狀態：✅ 已確認

### Q4. 版本範圍比對 — 影響範圍：`aqutter-cli` 依賴
- [ ] 新增 `semver` 套件（建議未採用）
- [x] 自寫最小解析（只支援 `^`、`~`、精確版本）
- **決議**：自寫最小解析（`^`、`~`、精確版本）　狀態：✅ 已確認

### Q5. 循環呼叫（A→B→A）— 影響範圍：殼 `callPlugin`
- [x] 不防護，文件註明禁止循環　(建議，理由：目前沒有實例，開發階段不加機制)
- [ ] 呼叫深度超過 8 層就拋 `PLUGIN_CALL_DEPTH`
- **決議**：不防護，文件禁止循環　狀態：✅ 已確認

## Key Decisions
- **[Q1]** Dart 端 A 呼叫 B，B 標 `internal` — 理由：A 的網頁端程式碼也經同一條 bridge 呼叫 B，在 bridge 層擋會連 A 一起擋掉，只有 Dart 端轉呼叫才能真正封裝。
- **[Q2]** `requires` 為「套件名 → semver 範圍」 — 理由：一個 App 每個 plugin 只能有一個版本，需要範圍才能在 `plugin add` 與 `doctor` 檢查相容。
- **[Q3]** 取 A 的 `package.json` `dependencies[B]` 的來源，B 成為 App 直接依賴 — 理由：pnpm 不提升間接依賴。
- **[Q4]** 自寫最小 semver 解析 — 理由：使用者選擇，不增加依賴；只支援 `^`、`~`、精確版本，其他語法在描述檔驗證時拒絕。
- **[Q5]** 不防護循環呼叫，文件禁止 — 理由：開發階段無實例。
- **[設計]** `internal` 只由 Dart `AqutterPlugin.internal` 宣告，不放進 `aqutter-plugin.json` — 理由：CLI 不需要它，單一來源避免兩邊不一致。

## Git Completion Policy
- 開發階段直接推送 `main`，不開 PR／issue／milestone。commit 一律自動。

## References
- 對話：2026-11-03 plugin 互相引用與封裝討論

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 把 `aqutter` 的 `0.0.0` tag 移到本次 shell commit 並強推 — `git tag -f 0.0.0 <hash>`、`git push -f origin 0.0.0` — 強推 tag 需要使用者明確同意
