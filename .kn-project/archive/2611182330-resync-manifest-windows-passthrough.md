# 2611182330-resync-manifest-windows-passthrough

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter#76
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 的 `core.ref` 同步到 aqutter_core #39（Windows 穿透）之後的主幹（`84d9174`）、`generatedAt` 更新；`shell.ref`、`client.spec` 不變。CI 的 manifest-check（schema、ref 存在、`shell.ref`、Flutter 基準）本機重現通過。
並修剪 `docs/nativeview.md` 中「穿透平台支援目前只有 Android」的過時說法，改為 Android、iOS、Windows（iOS 實機與 Windows 的其他顯示縮放未驗證）。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611182330-resync-manifest-windows-passthrough`　**共用分支名**: `feature/2611182330-resync-manifest-windows-passthrough`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json`（契約正本），並修剪 `docs/nativeview.md` 的平台說明　issue: `Aqutter/aqutter#76`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#46`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **後續（各自另案）**: `aqutter-nuxt-app` 前進鎖定，並用 `aqutter dev windows` 驗證 Windows 穿透、在 Android 確認沒有退步。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`。依據：`manifest/releases.json` 的 `core.ref`（`d431f0e…`）落後於 `aqutter_core` 的 `main`（#39）；CLI 快照為其副本。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者核准）。
- **[範圍]** `shell.ref`、`client.spec` 不變（本計畫不動 `shell/`，`docs/` 的修改不影響 `git log -1 -- shell`）。
- **[契約]** rev 1 凍結（核准日 2026-11-18）。
- **[完成後]** commit + 開 PR（push 前 fetch 並 rebase origin/main）— 使用者核准。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。wiki 頁無需改動（只有外部文件 docs/nativeview.md 變動）。

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新。
- `manifest/releases.json:21` — `core.ref`：`d431f0e…` → `84d917459d01ba7bd7424c131540db23e890851f`。
- `docs/nativeview.md:94` — `auto` 一列的「平台支援（目前只有 Android）」過時，改為 Android、iOS 與 Windows，並註明 iOS 實機與 Windows 的其他縮放未驗證。
