# 2611131354 - docs-doctor-path-length

- Created: 2026-11-13 13:54 / Archived: 2026-11-13 14:20
- Issue: Aqutter/aqutter#47
- Milestone: N/A / Base Branch: main

## Summary
`docs/cli.md` 的 `aqutter doctor` 檢查表新增「Windows 路徑長度」一列，與 aqutter-cli#21 的行為一致（Windows 上 appDir 絕對路徑超過 100 字元為警告）。
只改文件；wiki 的 ops/distribution.md 只提到 doctor 比對 lock 與版本，未受影響。

## Cross-Repo Scope
無（單一 repo）。行為來源：Aqutter/aqutter-cli PR #21。

## Key Decisions
- **[Phase 0]** Milestone 不指定，PR 併回 main — 理由：AGENTS.md 寫明開發階段版本一律 0.0.0。
- **[Q1]** 只改 docs/cli.md，不動 docs/windows.md — 理由：範圍最小。

## Deviations
None

## Impact Files
- `docs/cli.md:106` — doctor 檢查表最後一列之後新增「Windows 路徑長度」列
