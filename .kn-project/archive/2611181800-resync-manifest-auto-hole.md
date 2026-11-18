# 2611181800-resync-manifest-auto-hole

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter#72
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 同步到 core #37、js #17 之後的主幹：`core.ref` → `d431f0e`、`client.spec` → `#431ceab`、`generatedAt` 更新；`shell.ref` 不變（本計畫不動 `shell/`）。CI 的 manifest-check（schema、ref 存在、`shell.ref`、Flutter 基準 3.50.0／Dart 3.14.0）本機重現皆通過。
並修剪 `docs/nativeview.md` 與 wiki `webview-transparency.md` 中「頁面要自己清背景、自己挖洞」的過時說法，改寫為框架自動讓出背景（祖先透明、`data-aqutter-bg` 自動挖洞、`keep-background`、圓角取自元素）。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611181800-resync-manifest-auto-hole`　**共用分支名**: `feature/2611181800-resync-manifest-auto-hole`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json`（契約正本），並修剪 `docs/nativeview.md` 與 wiki 的過時說法　issue: `Aqutter/aqutter#72`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#42`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **後續（各自另案）**: `aqutter-nuxt-app` 前進鎖定、移除展示頁補的 CSS、推上 main、歸檔展示頁計畫。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`。依據：`manifest/releases.json` 的 `core.ref`（`d1c9062…`）與 `client.spec`（`#171a95a…`）落後於 `aqutter_core`／`aqutter-js` 的 `main`；CLI 快照為其副本。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者核准）。
- **[範圍]** `shell.ref` 不變（本計畫不動 `shell/`，`docs/` 與 wiki 的修改不影響 `git log -1 -- shell`）。
- **[契約]** rev 1 凍結（核准日 2026-11-18）。
- **[完成後]** commit + 開 PR（push 前 fetch 並 rebase origin/main）— 使用者核准。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新。
- `manifest/releases.json:21` — `core.ref`：`d1c9062…` → `d431f0ecc88e685e057fea6c930048390d28f603`。
- `manifest/releases.json:24` — `client.spec`：`#171a95a…` → `#431ceabcaf8a41b5680ccab5e2f30f0f28e744f8`。
- `docs/nativeview.md:95-101` — 修剪過時說法：`passthrough` 的「不偵測頁面條件、頁面作者自負責任」、「頁面條件：祖先不可有不透明背景」、「圓角與遮罩：網頁自己挖洞」，改寫為框架自動讓出背景（祖先透明、`data-aqutter-bg` 自動挖洞、`keep-background`、圓角取自元素 `border-radius`）。
- `.kn-project/wiki/platform/webview-transparency.md:50` — 「頁面條件」一列同步修剪。

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/webview-transparency.md` | 2026-11-18 | — | 頁面背景改為框架自動讓出，修剪過時說法 | [#72](https://github.com/Aqutter/aqutter/issues/72) | — |
