<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611131528 - sync-manifest-refs
- Created: 2026-11-13
- Branch: feature/2611131528-sync-manifest-refs
- Issue: Aqutter/aqutter#49
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
`aqutter doctor` 在全新安裝的專案回報「@aqutter/aqutter 與框架版本 0.0.0 不一致」：`manifest/releases.json` 把 aqutter-js 釘在舊提交 `bc84de7`，但 aqutter-js 的 `0.0.0` tag 已移到 `6a71990`，專案安裝到的與 manifest 要求的不是同一個提交。把 manifest 的 ref 同步到各 repo 目前的狀態，讓全新安裝的 doctor 不再出現這個警告。

## Architecture
- 只改宣告式資料 `manifest/releases.json`，不改程式。
- `client.spec`：`bc84de7…` → `6a71990cd365542b388d5054c6a320511fda3353`（aqutter-js 目前 main；兩者差異僅 `LICENSE` 一行，`git diff --stat bc84de7..HEAD` 已確認）。
- `shell.ref`：`b5f60fd…` → `8207b10ff9bb3d0cf5ba11c2f326d783fc019a90`（`git log -1 --format=%H -- shell` 的結果，依 `docs/releases.md` 的取得方式；與舊 ref 的差異僅一個測試提交）。
- `core.ref` 已是 `8833f948…` 等於 aqutter_core 的 main 與 tag，不動。
- `generatedAt` 更新為修改當下的 UTC 時間。
- 驗證：本機以 ajv 驗 schema（`docs/releases.md:65` 的指令）；合併後 CI `manifest-check` 會再檢查 ref 存在與 Flutter 基準。

## Cross-Repo Scope
無（單一 repo）。`Aqutter/aqutter-js`、`Aqutter/aqutter_core` 只被讀取其 commit sha，不修改。

## Contract / 介面契約
無（單一 repo）。`manifest/schema.json` 的欄位與格式不變，只更新既有欄位的值。

## Impact Files
- `manifest/releases.json:17` (`releases.0.0.0.shell.ref`) — 舊 ref `b5f60fd…` 更新為 `8207b10…`
- `manifest/releases.json:24` (`releases.0.0.0.client.spec`) — 舊 sha `bc84de7…` 更新為 `6a71990…`，這是 doctor 警告的直接原因
- `manifest/releases.json:3` (`generatedAt`) — 隨修改更新時間
- `.kn-project/wiki/` 與 `.kn-project/archive/` — Phase 5 歸檔與 wiki 更新（依流程，非手動改動）

證據：doctor 警告原文與 `bc84de7` 只出現在 `manifest/releases.json:24`（Grep 全 repo）；`docs/releases.md:52` 規定 `ref` 與 `client.spec` 要隨變更更新；`AGENTS.md` 紅線 2 要求「改完要同步更新 manifest 的 `client.spec`」。

## Open Questions / 待確認事項
> 無。milestone 與更新範圍已於對話中確認，見 Key Decisions。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 把 `aqutter` 的 `0.0.0` tag 移到合併後的 main — 對我說「移動 aqutter 的 tag」，或 `git tag -f 0.0.0 <main sha>` 後 `git push --force origin refs/tags/0.0.0` — 移動遠端 tag 屬對外覆寫，依 AGENTS.md 與先前慣例由你下令才做
- **[合併後]** 在全新目錄重跑 `aqutter doctor --refresh`，確認不再有「@aqutter/aqutter 與框架版本不一致」警告 — 例如 `C:\aqt\web2` — 需要在你的環境實際安裝，且要在 tag 移動之後才有意義

## Key Decisions
- **[Milestone]** 不指定，base 為 `main` — 理由：開發階段版本一律 `0.0.0`（AGENTS.md「工作流程」），沿用先前慣例；來源：Phase 0 Milestone 詢問
- **[範圍]** `client.spec` 與 `shell.ref` 一併更新 — 理由：`docs/releases.md` 規定 `ref` 取 `git log -1 --format=%H -- shell`，一併對齊可避免下次再出現落差；來源：Phase 2 提問
- **[完成後]** commit + 開 PR（預設）— 理由：沿用先前計畫；歷史改寫已揭露

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base，不依賴 `gh` 的預設值 (Rule 23)。
- 每個 commit 訊息與 PR body 都含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`）。歸檔後於該 issue 張貼結案留言 (Rule 20)。
- Issue 的關閉發生在合併後清理，不在歸檔當下 (Rule 21)。
- commit 一律自動（Rule 17）；完成時 `git fetch` 後 `git rebase origin/main` 並以 `git push --force-with-lease --force-if-includes` 更新遠端工作分支。
- PR/archive order: Archive automatically triggered on PR request

## References
- `aqutter doctor` 實測輸出（`C:\aqt\web2`，`--refresh` 後仍有警告）
- `docs/releases.md`（新增或更新一個版本）
- `.github/workflows/manifest-check.yml`
