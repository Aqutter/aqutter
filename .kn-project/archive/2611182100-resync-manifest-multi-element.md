# 2611182100-resync-manifest-multi-element

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter#74
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 的 `client.spec` 同步到 aqutter-js #19 之後的主幹（`#3f250d6`）、`generatedAt` 更新；`shell.ref`、`core.ref` 不變。CI 的 manifest-check（schema、ref 存在、`shell.ref`）本機重現通過。
並在 `docs/nativeview.md` 補上：同一頁可有多個穿透元素（每個元素一個洞、祖先背景最後一個釋放才還原），以及祖先的不透明背景會被一併清掉的副作用。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611182100-resync-manifest-multi-element`　**共用分支名**: `feature/2611182100-resync-manifest-multi-element`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json`（契約正本），並補 `docs/nativeview.md` 的說明　issue: `Aqutter/aqutter#74`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#44`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **後續（各自另案）**: `aqutter-nuxt-app` 前進鎖定，並用 plugins 頁在實機確認 mirror-demo 與 google-maps 同時正確。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`。依據：`manifest/releases.json` 的 `client.spec`（`#431ceab…`）落後於 `aqutter-js` 的 `main`（#19）；CLI 快照為其副本。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者核准）。
- **[範圍]** `shell.ref`、`core.ref` 不變（本計畫不動 `shell/`，`docs/` 的修改不影響 `git log -1 -- shell`）。
- **[契約]** rev 1 凍結（核准日 2026-11-18）。
- **[完成後]** commit + 開 PR（push 前 fetch 並 rebase origin/main）— 使用者核准。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。wiki 頁無需改動（只有外部文件 docs/nativeview.md 變動）。

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新。
- `manifest/releases.json:24` — `client.spec`：`#431ceab…` → `#3f250d6d9c09c48a9c0cfd7e783b8c2a884734fe`。
- `docs/nativeview.md:99` — 「頁面背景自動讓開」一條補：同一頁可有多個穿透元素（每個元素一個洞、祖先背景最後一個釋放才還原），以及祖先的不透明背景（例如包著地圖的卡片）會被一併清掉。
