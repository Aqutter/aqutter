# 2611141900-resync-manifest-refs

- Created: 2026-11-14 19:00 / Archived: 2026-11-14 19:20
- Issue: Aqutter/aqutter#59
- Milestone: N/A / Base Branch: main

## Summary
把 manifest 的 shell.ref 與 core.ref 對齊 Kotlin/AGP 升級合併後的最新提交（4e7bd71、911caa0），baseline、dart、client.spec 不變。

驗證：ajv schema 通過；在本機重現 CI 的比對——兩個新 ref 的 pubspec 都要求 Flutter >=3.50.0、shell 的 sdk 等於 manifest 的 dart。doctor 端到端需合併後。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方）、aqutter-cli（快照，消費方）。共用 ID `2611141900-resync-manifest-refs`、共用分支 `feature/2611141900-resync-manifest-refs`。順序：aqutter 先合併，aqutter-cli 後合併。承接 `2611141800-upgrade-kotlin-agp-flutter-3-50` 的人工收尾。

## Key Decisions
- **[核准]** 使用者全部核准；完成後採預設 commit + 開 PR；Issue 已建立並回填（aqutter#59、aqutter-cli#32）。
- **[Phase 0]** 承接已合併的 Kotlin/AGP 升級（`2611141800-upgrade-kotlin-agp-flutter-3-50`）的人工收尾：該計畫改了 shell 與 aqutter_core，manifest 的 ref 因此落後。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`；aqutter、aqutter-cli、aqutter_core、aqutter-js 皆已在乾淨的最新 `main`。
- **[Phase 0]** 整合主幹：遠端無 dev／develop 類分支，採 `origin/HEAD`＝`main`，不詢問、不記錄。
- **[ref]** `shell.ref` = `git log -1 --format=%H -- shell` = `4e7bd71a64a9c8ec2dba28a52a926f6ac72e894c`；`core.ref` = aqutter_core 目前 main = `911caa0aeb45ce4ab394f7cdb0f0dbefd661187c`；`client.spec` 不變（aqutter-js main 仍在 `6a71990`）；`flutter.baseline` 與 `dart` 不變（3.50.0／`>=3.14.0 <4.0.0`）。
- **[順序]** `aqutter` 的 manifest 先合併，`aqutter-cli` 後合併（快照取自 manifest）。
- **[執行模式]** 序列（先 `aqutter`，再 `aqutter-cli`）。
- **[未驗證]** 全新專案的 `aqutter doctor` 端到端（需合併後）。

## Deviations
無。

## Impact Files
- `manifest/releases.json:17` — `shell.ref` → `4e7bd71a64a9c8ec2dba28a52a926f6ac72e894c`
- `manifest/releases.json:21` — `core.ref` → `911caa0aeb45ce4ab394f7cdb0f0dbefd661187c`
- `manifest/releases.json:3` — generatedAt 更新
