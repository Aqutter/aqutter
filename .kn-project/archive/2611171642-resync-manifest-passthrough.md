# 2611171642-resync-manifest-passthrough

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter#70
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 同步到穿透模式合併後的主幹：`shell.ref` 指向 #69 的合併提交，`core.ref` 指向 aqutter_core #32，`client.spec` 指向 aqutter-js #15；`generatedAt` 更新。CI 的 manifest-check（schema、ref 存在、pubspec 基準）本機重現皆通過。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611171642-resync-manifest-passthrough`　**共用分支名**: `feature/2611171642-resync-manifest-passthrough`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json` 的三個 ref 與 `generatedAt`（契約正本）　issue: `Aqutter/aqutter#70`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#40`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`（依據：`manifest/releases.json:17,21,24` 的 ref 落後於三個 repo 的 `main`；CLI 快照 `src/manifestSnapshot.json` 為其副本）。`aqutter-nuxt-app` 的鎖定是另一份單一 repo 計畫。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者於 Phase 0 選擇）。
- **[範圍]** 三個 ref 與 `generatedAt`；`shell.ref` 取 `git log -1 --format=%H -- shell`，本計畫不動 `shell/`，所以合併後仍成立。
- **[契約]** rev 1 凍結（核准日 2026-11-17）。
- **[完成後]** commit + 開 PR（Rule 12 非互動鏈；完成前自動 fetch 後 rebase origin/main 並 push --force-with-lease --force-if-includes）。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新。
- `manifest/releases.json:17` — `shell.ref`：`f47a1f2…` → `75016d9e4a15f21e7c3847d330ed678b14bc2ae8`。
- `manifest/releases.json:21` — `core.ref`：`522669e…` → `d1c9062fe3bea9494679cf989f8542b71d38b92c`。
- `manifest/releases.json:24` — `client.spec`：`#6a71990…` → `#171a95afa6237522ca9a3bc99cbe2e42d1c14dec`。
