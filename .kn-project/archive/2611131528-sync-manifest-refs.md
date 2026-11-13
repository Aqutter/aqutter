# 2611131528 - sync-manifest-refs

- Created: 2026-11-13 15:28 / Archived: 2026-11-13 15:45
- Issue: Aqutter/aqutter#49
- Milestone: N/A / Base Branch: main

## Summary
`aqutter doctor` 在全新安裝的專案回報 aqutter-js 版本不一致，原因是 `manifest/releases.json` 把 aqutter-js 釘在舊提交 `bc84de7`，而 `0.0.0` tag 已移到 `6a71990`。
把 `client.spec` 與 `shell.ref` 同步到各 repo 目前的提交，並更新 `generatedAt`。只改宣告式資料，沒有程式變更。

## Cross-Repo Scope
無（單一 repo）。`Aqutter/aqutter-js`、`Aqutter/aqutter_core` 只被讀取 commit sha。

## Key Decisions
- **[Milestone]** 不指定，PR 併回 main — 理由：開發階段版本一律 0.0.0（AGENTS.md「工作流程」）。
- **[範圍]** `client.spec` 與 `shell.ref` 一併更新 — 理由：`docs/releases.md` 規定 `ref` 取 `git log -1 --format=%H -- shell`，一併對齊避免下次再落差。
- **[核實]** 兩處差異都很小：aqutter-js 只差 `LICENSE` 一行，shell 只差一個測試提交 `8207b10`。

## Deviations
- 計畫的第三個工作項（以修改後的 manifest 對全新專案重跑 `aqutter doctor`）合併前無法端到端驗證：doctor 讀的是 GitHub 上 main 的 manifest。本機只驗了 schema（ajv valid）與三個 sha 在 GitHub 上存在；端到端驗證列為合併後的人工收尾。

## Impact Files
- `manifest/releases.json:17` — `shell.ref` `b5f60fd…` → `8207b10ff9bb3d0cf5ba11c2f326d783fc019a90`
- `manifest/releases.json:24` — `client.spec` `bc84de7…` → `6a71990cd365542b388d5054c6a320511fda3353`
- `manifest/releases.json:3` — `generatedAt` 更新
