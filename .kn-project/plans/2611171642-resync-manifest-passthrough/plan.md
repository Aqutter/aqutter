# Plan: 2611171642 - resync-manifest-passthrough
- Created: 2026-11-17
- Branch: feature/2611171642-resync-manifest-passthrough
- Issue: Aqutter/aqutter#70
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
把 manifest 的 `shell.ref`、`core.ref`、`client.spec` 同步到三個 repo 目前 `main` 上的 commit（穿透模式的 PR 都已合併，0.0.0 tag 已移動），讓 `aqutter doctor` 不再對鎖在新 commit 的專案警告「框架記載的版本較舊」。

## Architecture
- `manifest/releases.json` 記著 0.0.0 的三個 ref：`shell.ref`（`:17`）、`core.ref`（`:21`）、`client.spec`（`:24`）與 `generatedAt`（`:3`）。
- CI `manifest-check`（`.github/workflows/manifest-check.yml`）驗：ajv schema、ref 存在、`shell.ref` 等於 `git log -1 --format=%H -- shell`、新 ref 的 pubspec Flutter／sdk 基準一致。
- 本機重現：`npx ajv-cli@5.0.0 validate`（同 CI 參數）、`git log -1 --format=%H -- shell`、讀新 core／shell 的 pubspec（皆 sdk `>=3.14.0 <4.0.0`、flutter `>=3.50.0`，已查證）。
- 程式碼風格：只改 JSON 資料，無程式碼；仍遵守 `kn-project-code-style` 的 JSON 排版（維持原檔縮排）。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611171642-resync-manifest-passthrough`　**共用分支名**: `feature/2611171642-resync-manifest-passthrough`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json` 的三個 ref 與 `generatedAt`（契約正本）　issue: `Aqutter/aqutter#70`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#40`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-17）`

### 1. 介面
| # | 介面 | 提供方 | 消費方 |
|---|---|---|---|
| 1 | `manifest/releases.json`（schema 1） | `aqutter` | `aqutter-cli` 內建快照 `src/manifestSnapshot.json`、`aqutter doctor`、`aqutter upgrade` |

### 2. 欄位（本次變動的）
| 欄位 | 值 | 來源 |
|---|---|---|
| `generatedAt` | 套用當下的 UTC 時間 | 手動更新 |
| `releases.0.0.0.shell.ref` | `75016d9e4a15f21e7c3847d330ed678b14bc2ae8` | `git log -1 --format=%H -- shell`（aqutter PR #69 的合併 commit，之後不被 `manifest/` 的變更改動） |
| `releases.0.0.0.core.ref` | `d1c9062fe3bea9494679cf989f8542b71d38b92c` | aqutter_core PR #32 的合併 commit（= 其 `main` 與 0.0.0 tag） |
| `releases.0.0.0.client.spec` | `github:Aqutter/aqutter-js#171a95afa6237522ca9a3bc99cbe2e42d1c14dec` | aqutter-js PR #15 的合併 commit（= 其 `main` 與 0.0.0 tag） |
其餘欄位（`flutter.baseline`、`dart`、`channels`、`cli.min`、各 `url`、`path`）不變。

### 3. 錯誤碼
無（CI `manifest-check` 的失敗即為錯誤：schema 不符、ref 不存在、`shell.ref` 不等於 `git log -1 --format=%H -- shell`、pubspec 的 Flutter／sdk 基準不一致）。

### 4. 狀態與規則
- 快照必須與 `releases.json` **逐字相同**，由 `pnpm manifest:sync <path>` 產生，不手改；`dist/aqutter.mjs` 由 `pnpm build` 重產。
- 順序：`aqutter` 先、`aqutter-cli` 後。

### 5. 相容性
只更新三個 ref 與時間，schema 與其他欄位不變；舊版 CLI 讀到新 manifest 沒有結構差異。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新。
- `manifest/releases.json:17` — `shell.ref`：`f47a1f2…` → `75016d9e4a15f21e7c3847d330ed678b14bc2ae8`。
- `manifest/releases.json:21` — `core.ref`：`522669e…` → `d1c9062fe3bea9494679cf989f8542b71d38b92c`。
- `manifest/releases.json:24` — `client.spec`：`#6a71990…` → `#171a95afa6237522ca9a3bc99cbe2e42d1c14dec`。

## App-Flow Screens
（無 app-flow.json，略）

## Open Questions / 待確認事項
無。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 移動 `aqutter` 的 0.0.0 tag 到合併後的 `main` — 依既有「移動 tag」流程，需要使用者下指令 — 發佈錨點由人決定。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`（依據：`manifest/releases.json:17,21,24` 的 ref 落後於三個 repo 的 `main`；CLI 快照 `src/manifestSnapshot.json` 為其副本）。`aqutter-nuxt-app` 的鎖定是另一份單一 repo 計畫。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者於 Phase 0 選擇）。
- **[範圍]** 三個 ref 與 `generatedAt`；`shell.ref` 取 `git log -1 --format=%H -- shell`，本計畫不動 `shell/`，所以合併後仍成立。
- **[契約]** rev 1 凍結（核准日 2026-11-17）。
- **[完成後]** commit + 開 PR（Rule 12 非互動鏈；完成前自動 fetch 後 rebase origin/main 並 push --force-with-lease --force-if-includes）。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base (Rule 23)。
- Issue 綁定時，每個 commit 訊息與 PR body 都含 `Closes #${N}`。
- commit 一律自動；完成時依核准閘的「完成後」選項。
- 跨 repo 時，本 repo 自己開自己的 PR。

## References
- 前例：`.kn-project/archive/2611161111-resync-manifest-core.md`（同一類同步）。
- 起因：aqutter_core、aqutter-js、aqutter 的 `native-passthrough-mode` PR 已合併並移動 0.0.0 tag，manifest 仍記著舊的 ref。
