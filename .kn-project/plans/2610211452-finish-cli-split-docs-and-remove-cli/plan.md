# 2610211452 - finish-cli-split-docs-and-remove-cli

- Status: Planning
- Created: 2026-10-21 14:52
- Issue: 待建立
- Milestone: N/A / Base Branch: main

## Summary
完成「`cli/` 拆成 `Aqutter/aqutter-cli`」的收尾：把本 repo 所有仍描述「CLI 在本 repo」的文件改寫為拆分後的樣子，最後移除舊 `cli/` 目錄。

前置計畫 `2610211114-split-cli-to-aqutter-cli-repo` 已在三個 repo 完成（manifest 上線、`aqutter-cli` 可安裝並有 tag `0.0.0`、範本專案已遷移），本計畫是其被移出的後續項目。

## Cross-Repo Scope
- 單一 repo：`Aqutter/aqutter`。
- 參照（已完成）：`Aqutter/aqutter#2`、`Aqutter/aqutter-cli#1`、`Aqutter/aqutter-nuxt-app#1`。

## Contract
無。契約 rev 1（release manifest）不變。

## Goals
1. 所有安裝與組成說明列出 npm、pnpm、yarn、bun 四種套件管理器，CLI 依賴為 `github:Aqutter/aqutter-cli#0.0.0`。
2. `docs/cli.md`、`docs/releases.md` 反映 `doctor`/`upgrade` 已讀 manifest（`--offline`、`AQUTTER_MANIFEST_URL`），修正過時敘述。
3. 治理檔（`AGENTS.md`、`project.md`）與 wiki 不再提 `cli/` 在本 repo、不再有 `cd cli …` 驗證步驟。
4. 移除 `cli/`。

## Impact Files
- `README.md:11,20-21`、`docs/getting-started.md:16-17`、`client/README.md:14` — 安裝說明與目錄表。
- `docs/cli.md:3,94,104,109,113,121` — 開頭註明對應 CLI 版本與正本在 `aqutter-cli`；doctor/upgrade 改寫；修正 `:109` 過時的 `--offline` 說明。
- `docs/releases.md:5` — 刪除「沒有 CLI 讀它」。
- `AGENTS.md:7,10-14,19-20` — 紅線 1、3、4、4.1、5 與驗證區塊（移除 `cd cli …`）。
- `.kn-project/project.md:12,21,23,34-37,47`。
- wiki：`ops/distribution.md`、`dev/verification.md:30`、`environment.md:22`、`platform/architecture.md`。
- `cli/`（`git rm -r`，最後一步，不可回復）。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；milestone 不指定，base 為 `main`。
- **[Q1]** `docs/cli.md` 留在本 repo，標明對應 CLI 版本，正本指向 `aqutter-cli` README — 理由：日後 VitePress 站（issue #1）統一收錄。
- **[Q2]** 跨 repo 成對規則（env 鍵、Flutter 版本、範本變數）只寫文件，不新增 CI — 理由：Flutter 基準已由 `manifest-check` 與 `aqutter-cli` CI 覆蓋。
- **[設計]** 移除 `cli/` 放最後一步；閘門：`aqutter-cli` 可安裝（已達成）、npm/yarn/pnpm 驗證（已達成）、下游已遷移（已達成）、**bun 人工驗證（待人工）**。
- **[執行模式]** 序列。**[完成後]** 待核准時決定。

## Manual Follow-ups
- bun：`bun add -d "github:Aqutter/aqutter-cli#0.0.0"` 然後 `bunx aqutter --version`，通過後才可執行移除 `cli/`。
