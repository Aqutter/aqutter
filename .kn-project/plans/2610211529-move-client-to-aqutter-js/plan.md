<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610211529 - move-client-to-aqutter-js
- Created: 2026-10-21
- Branch: feature/2610211529-move-client-to-aqutter-js
- Issue: Aqutter/aqutter#7
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
讓 `@aqutter/aqutter`（client）在 npm、pnpm、yarn 都能安裝：把 `client/` 搬到新 repo `Aqutter/aqutter-js`（根目錄安裝，不再需要只有 pnpm 認得的 `&path:/client`），本 repo 改指 manifest 到新位置、改寫文件，並移除 `client/`。
開發階段採破壞式移動，不留舊語法相容層。

## Architecture
client 原本在本 repo 子目錄，只有 pnpm 支援 `github:Aqutter/aqutter#<ref>&path:/client`；npm、yarn 無法安裝。拆成獨立 repo 後，安裝字串變成 `github:Aqutter/aqutter-js#<ref>`，和 CLI 一樣各管理器通用。
本 repo 保留 shell；client 與 shell 的跨語言成對規則（handler／事件名稱、鏡像協定）改為跨 repo 約束，版本對應仍以 `manifest/releases.json` 為準。

## Cross-Repo Scope
- **共用計畫 ID**: `2610211529-move-client-to-aqutter-js`　**共用分支名**: `feature/2610211529-move-client-to-aqutter-js`
- **參與 repo 與職責**（一 repo 一 issue，尚未建立者寫 `待建立`）:
  - `Aqutter/aqutter`（契約正本；本計畫）— manifest `client.spec` 改新位置、`manifest-check` 改檢查、文件與治理檔改寫、最後移除 `client/`。issue: 待建立
  - `Aqutter/aqutter-js`（新 repo）— 承接 `client/` 內容與 tag `0.0.0`；建立後另有自己的計畫與 issue。issue: 待建立
  - `Aqutter/aqutter-cli`（消費方）— 辨識新格式、`upgrade` 改寫、`plugin create` 與範本、內建 manifest 快照。issue: 待建立
  - `Aqutter/aqutter-nuxt-app`（下游）— `package.json` 的 client 依賴與 lock。issue: 待建立
  - `Aqutter/aqutter-plugin-battery`、`aqutter-plugin-haptics`、`aqutter-plugin-mirror-demo`、`aqutter-plugin-google-maps`（下游，各自一份計畫）— `package.json` 的 client 依賴與 lock。issue: 待建立
- **執行順序相依**: ① 建立 `aqutter-js` 並匯入內容、打 tag → ② `aqutter`（取得 aqutter-js 的 sha 後改 manifest、文件，並移除 `client/`）合併 → ③ `aqutter-cli`（從合併後的 manifest 同步快照）→ ④ `aqutter-nuxt-app` 與四個 plugin（用新 CLI 的 `upgrade` 或手改依賴，重產 lock）。契約提供方先、消費方後。
- **範圍外**: 不改 npm 套件名；不新增 npm 發佈；bun 驗證；跨 repo CI 比對。

- **本計畫所屬 repo**: `Aqutter/aqutter`

## Contract / 介面契約
- **契約正本 repo**: `Aqutter/aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-10-21）`

### 1. aqutter-js 套件
| 項目 | 值 |
|---|---|
| repo | `Aqutter/aqutter-js`（公開） |
| 內容 | 原 `Aqutter/aqutter` 的 `client/` 目錄內容，放在 repo 根目錄（`package.json`、`src/`、`test/`、`test-types/`、`tsconfig.json`、`README.md`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`） |
| npm 套件名 | `@aqutter/aqutter`（不改名） |
| `exports` | 不變：`.` → `./src/index.ts`、`./contract` → `./src/contract/index.ts`、`./native` → `./src/nativeview/register.ts` |
| `files` | 不變：`src`、`README.md`（以 TypeScript 原始碼發佈，由使用端打包器編譯） |
| 版本標記 | 第一個 commit 打 tag `0.0.0`（開發階段沿用，會隨 `main` 移動） |
| 歷史 | 不保留；新 repo 第一個 commit 為匯入當下的 `client/` 內容 |

### 2. 安裝字串（client 依賴）
| 項目 | 值 |
|---|---|
| 格式 | `github:Aqutter/aqutter-js#<ref>`，不含任何 `&path:` |
| manifest `client.spec` | `ref` 為 40 位 commit sha |
| 手動／plugin 範本 | `ref` 可為 tag（如 `0.0.0`）或 sha |
| 支援的套件管理器 | npm、pnpm、yarn（repo 根目錄安裝，同 `github:Aqutter/aqutter-cli#<ref>`）；bun 尚未驗證 |
| 舊格式 | `github:Aqutter/aqutter#…&path:/client` **不再支援**，不做相容處理（開發階段破壞式移動） |

### 3. manifest（契約 rev 1 的結構不變）
| 項目 | 值 |
|---|---|
| 欄位 | `releases.<版本>.client.spec`（非空字串）；schema 不動 |
| `0.0.0` 的 `client.spec` | 原地改為 `github:Aqutter/aqutter-js#<aqutter-js 初始 commit 的 sha>`（使用者決定原地修改，不新增版本） |
| CI 檢查 | `manifest-check` 驗證 `client.spec` 符合上述格式，且 `Aqutter/aqutter-js` 上存在該 commit |
| `shell`、`core`、`flutter`、`dart`、`cli` | 不變 |

### 4. 錯誤與行為
| 情境 | 行為 |
|---|---|
| 專案的 `@aqutter/aqutter` 不是 `github:Aqutter/aqutter-js#…` 形態 | `aqutter doctor` 與 `aqutter upgrade` 不處理該依賴（視為使用者自管） |
| 專案的 `@aqutter/aqutter` 是 `github:Aqutter/aqutter-js#…` 但與 manifest 不同 | `doctor` 警告；`upgrade` 改寫為 manifest 的 `client.spec` |
| `aqutter plugin create` 取 client ref | 由 manifest `client.spec` 取 `#` 之後整段；`--shell-ref` 明給時沿用 |

### 5. 相容性
- 不保留舊語法的任何相容層；以 commit sha 鎖定舊語法的既有專案仍能安裝（舊 commit 仍在 `Aqutter/aqutter` 的歷史中），但框架不再支援。
- client 與 shell／aqutter_core 的跨語言成對規則（handler／事件名稱、鏡像協定）不變，只是分屬兩個 repo；同步靠 `AGENTS.md` 紅線與 manifest 的版本對應。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `manifest/releases.json:24`（`releases.0.0.0.client.spec`）— 改為 `github:Aqutter/aqutter-js#<sha>`（需先有 aqutter-js 的初始 commit）。
- `.github/workflows/manifest-check.yml:123-132` — 步驟 4 的正規式與 `repos/Aqutter/aqutter/commits/` 改為驗證新格式與 `Aqutter/aqutter-js` 上的 commit；`client.spec` 不符新格式時回報錯誤。
- `manifest/schema.json:87`（`client`）— 檢視 `spec` 描述是否需補新格式（結構不動）。
- `docs/releases.md:34,52` — `client` 欄位說明與「新增或更新版本」步驟的對象。
- `README.md:10,23` — 組成表的 `client/` 列改為指向 aqutter-js；快速開始的 client 安裝改 `npm i github:Aqutter/aqutter-js#0.0.0` 等。
- `docs/getting-started.md:24-30` — client 安裝說明改為四種之外的三種（npm、pnpm、yarn；bun 未驗證），移除「只有 pnpm」的限制說明。
- `docs/cli.md:128` — `upgrade` 對 client 依賴的描述改為新格式。
- `AGENTS.md:8,9` — 紅線 2、2.1 的 `client/src/...` 路徑改為 `Aqutter/aqutter-js` 的對應路徑並標明跨 repo；`AGENTS.md:10` 一併提醒 client 在 aqutter-js。
- `.kn-project/project.md:11,21,24` — 目錄表移除 `client/`；發佈與安裝說明；Native view 鏡像的 `client/src/nativeview/...` 路徑。
- `shell/lib/src/bridge/bridge_names.dart:1` — 註解的 `client/src/contract/bridge.ts` 改為 `Aqutter/aqutter-js` 的路徑。
- wiki：`ops/distribution.md`、`platform/architecture.md`、`dev/verification.md`（移除 `cd client …` 驗證段）；`client/` 移除前先確認 `docs/*.md` 無其他連結（`grep "client/"` 目前只有上列檔案）。
- `client/`（整個目錄，`git rm -r`）— 最後一步，不可回復；閘門：aqutter-js 已含相同內容並打 tag、`aqutter-cli`、`aqutter-nuxt-app`、四個 plugin 已遷移。

## Open Questions / 待確認事項
無（已全部確認，見 Key Decisions）

## Manual Follow-ups / 人工收尾事項
- **[合併後]** bun 對 `github:Aqutter/aqutter-js#…` 的安裝驗證（本機無 bun）— `bun add -d "github:Aqutter/aqutter-js#0.0.0"` — 本機沒有 bun；文件標為尚未驗證

## Key Decisions
- **[Phase 0]** 目標 repo 清單見 Cross-Repo Scope；整合主幹 `main`；milestone 不指定，base 為 `main`（逐 repo 詢問，皆選不指定）。
- **[路線]** client 拆成獨立 repo `Aqutter/aqutter-js`（使用者選擇，取代「發佈 npm」與「CI 鏡像分支」）— 理由：不需 npm 帳號與憑證，四種套件管理器都能以根目錄安裝，同 `aqutter-cli` 流程。
- **[命名]** repo 名 `aqutter-js`（連字號，對齊 `aqutter-cli`）；npm 套件名 `@aqutter/aqutter` 不改 — 理由：已寫入紅線 1、範本、manifest，改名是破壞性變更，等確定發佈 npm 時再議。
- **[歷史]** aqutter-js 不保留 `client/` 的 git 歷史，全新起點 — 來源：使用者選擇。
- **[manifest]** 原地修改 release `0.0.0` 的 `client.spec`，不新增版本 — 來源：使用者選擇；已知例外於 `docs/releases.md`「已發佈版本不改欄位」規則，開發階段 `0.0.0` 本就隨 `main` 移動。
- **[破壞式移動]** 開發階段不考慮既有程式、不留過渡相容層，改完同步修改 `aqutter-nuxt-app` 與四個 plugin repo — 來源：使用者指示（2026-10-21）。
- **[契約]** rev 1 凍結（核准日 2026-10-21）。
- **[完成後]** commit + 開 PR（併回 `main`）。
- **[執行模式]** 序列（相依鏈是一條線）；**[完成後]** 待核准閘決定。
- **[client/ 處理]** 直接移除，放最後一步 — 來源：使用者「破壞式移動」指示；沿用先前移除 `cli/` 的作法。

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定。
- Issue 綁定後，每個 commit 與 PR body 含 `Closes #N`（N 取自 `- Issue:`）。
- commit 自動；完成時依核准閘的「完成後」選項。

## References
- `Aqutter/aqutter#4`、`Aqutter/aqutter-cli#1`、`Aqutter/aqutter-nuxt-app#1`（前置的 cli 拆分）

## Deviations
- aqutter-js 已建立（`Aqutter/aqutter-js`，初始 commit `ac7c23b`，tag `0.0.0`），npm／yarn／pnpm 皆已用該 sha 實測可安裝。
- 移除 `client/` 與其他修改在同一個 PR，而非「下游遷移完成後」：下游（CLI、範本專案、plugin）必須先有合併後的 manifest 才能遷移，破壞式移動不留相容層（使用者指示）。
