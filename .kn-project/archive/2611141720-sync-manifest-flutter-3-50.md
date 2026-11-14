# 2611141720-sync-manifest-flutter-3-50

- Created: 2026-11-14 17:20 / Archived: 2026-11-14 17:45
- Issue: Aqutter/aqutter#55
- Milestone: N/A / Base Branch: main

## Summary
把 manifest/releases.json 的 Flutter 基準與 ref 對齊已合併的 3.50 升級（baseline 3.50.0、dart >=3.14.0、shell.ref、core.ref、generatedAt），讓 doctor／upgrade 與 manifest-check CI 看到一致的版本。

驗證：ajv schema 通過；在本機重現 CI 的比對——shell 與 aqutter_core 在新 ref 的 pubspec 都要求 Flutter >=3.50.0、shell 的 sdk 等於 manifest 的 dart，client 提交存在。doctor 的端到端確認需合併後。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方）、aqutter-cli（快照，消費方）。共用 ID `2611141720-sync-manifest-flutter-3-50`、共用分支 `feature/2611141720-sync-manifest-flutter-3-50`。順序：aqutter 先合併，aqutter-cli 後合併。承接已合併的 `2611141530-upgrade-flutter-3-50` 的 Q1 決議。

## Key Decisions
- **[核准]** 使用者全部核准；完成後採預設 commit + 開 PR；Issue 已建立並回填（aqutter#55、aqutter-cli#28）。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`；兩個 repo 皆已 sync 至 `origin/main` 且工作區乾淨。
- **[Phase 0]** 整合主幹：遠端無 dev／develop 類分支，採 `origin/HEAD`＝`main`，不詢問、不記錄。
- **[Phase 0]** 本計畫承接已合併的「升級 Flutter 至 3.50」（`2611141530-upgrade-flutter-3-50`）的 Q1 決議：manifest 的 baseline 與 ref 於各 PR 合併後另走同步。
- **[ref]** `core.ref` 取 `aqutter_core` 目前 main 的 `aa44625f6d68daa4a1e2c1d6d4633a8b460b4669`（比照前一次同步取 HEAD）；`shell.ref` 取 `git log -1 --format=%H -- shell` ＝ `ef94f7376ce4d771494a3e090f3dbcfd5fac5272`（`docs/releases.md` 規定）；`client.spec` 不變（aqutter-js main 與 tag 0.0.0 仍在 `6a71990`）。
- **[執行模式]** 序列（先 `aqutter`，再 `aqutter-cli`；快照由 manifest 產生）。

## Deviations
無。

## Impact Files
- `manifest/releases.json:11` — baseline `3.47.8` → `3.50.0`
- `manifest/releases.json:13` — dart → `>=3.14.0 <4.0.0`
- `manifest/releases.json:17` — shell.ref → `ef94f7376ce4d771494a3e090f3dbcfd5fac5272`
- `manifest/releases.json:21` — core.ref → `aa44625f6d68daa4a1e2c1d6d4633a8b460b4669`
- `manifest/releases.json:3` — generatedAt 更新
