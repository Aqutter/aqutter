# 2610271726 - cli-manifest-refresh-and-downgrade-guard

- Created: 2026-10-27 17:26 / Archived: 2026-10-27 19:00
- Issue: Aqutter/aqutter#29
- Milestone: N/A / Base Branch: main

## Summary
`docs/cli.md` 補上 CLI 的 `--refresh`、`--allow-downgrade`、清單來源的快取年齡顯示與 `upgrade` 的降級保護說明（對應 `Aqutter/aqutter-cli` 的實作）。

## Cross-Repo Scope
- 共用計畫 ID `2610271726-cli-manifest-refresh-and-downgrade-guard`、共用分支名 `feature/2610271726-cli-manifest-refresh-and-downgrade-guard`。
- `Aqutter/aqutter-cli`（契約正本）：`--refresh`、快取年齡顯示、`upgrade` 降級保護。
- `Aqutter/aqutter`：只改 `docs/cli.md`。
- 順序：`aqutter-cli` 先，文件在其後。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；兩個 repo milestone 皆不指定，base 為 `main`。
- **[原因]** 範本專案的 `aqutter upgrade` 用了前一天的本機快取（24 小時內視為有效），無聲降級（Flutter 3.47.8 → 3.47.4、client 退回舊版）。
- **[Q1]** 降級預設拒絕，`--allow-downgrade` 才放行（不只警告）。
- **[範圍]** 快取有效期維持 24 小時，不縮短；只新增 `--refresh`、輸出顯示快取年齡、降級保護。
- **[契約]** rev 1 凍結（2026-10-27）。
- **[完成後]** commit + 開 PR（併回 `main`）。

## Deviations
無。

## Impact Files
- `docs/cli.md`（`doctor`、`upgrade` 旗標表、新增「降級保護」小節、「清單來源」一節）。
- `.kn-project/wiki-data/ext/__up/docs/cli.md.js` — `wiki-build.py` 重新產生。

## Details
- 驗證：`wiki-lint.py` 通過（硬閘 0）。
