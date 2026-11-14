# 2611150300-resync-manifest-ios-16

- Created: 2026-11-15 03:00 / Archived: 2026-11-15 03:30
- Issue: Aqutter/aqutter#63
- Milestone: N/A / Base Branch: main

## Summary
把 manifest 的 shell.ref 與 core.ref 對齊「最低 iOS 16」合併後的最新提交（f47a1f2、6aa0947），baseline、dart、client.spec 不變。

驗證：ajv schema 通過；在本機重現 CI 的比對——兩個新 ref 的 pubspec 都要求 Flutter >=3.50.0、sdk >=3.14.0，client 提交存在。doctor 端到端需合併後。同時已把 aqutter_core 的 tag 0.0.0 強制移到 6aa0947（使用者核准）。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方）、aqutter-cli（快照，消費方）、aqutter_core（只移動 tag）。共用 ID `2611150300-resync-manifest-ios-16`、共用分支 `feature/2611150300-resync-manifest-ios-16`。順序：aqutter 先合併，aqutter-cli 後合併。承接 `2611150100-ios-16-gmaps-sdk10` 的人工收尾。

## Key Decisions
- **[核准]** 使用者全部核准（含先強制移動 aqutter_core 的 tag `0.0.0`）；完成後採預設 commit + 開 PR；Issue 已建立並回填（aqutter#63、aqutter-cli#36）。
- **[Phase 0]** 承接已合併的「最低 iOS 16 與 `_sdk10`」（`2611150100-ios-16-gmaps-sdk10`）的人工收尾：該計畫改了 aqutter_core 與 shell，manifest 的 ref 因此落後；tag `0.0.0` 也落後。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`；aqutter、aqutter-cli、aqutter_core、aqutter-js 皆在乾淨的最新 `main`。
- **[Phase 0]** 整合主幹：遠端無 dev／develop 類分支，採 `origin/HEAD`＝`main`，不詢問、不記錄。
- **[ref]** `shell.ref` = `git log -1 --format=%H -- shell` = `f47a1f2b4029950284f119b03c4e6be6ab23367d`；`core.ref` = aqutter_core 目前 main = `6aa0947abb7cd694604d2c9ccb5d03c34f4c3705`；`client.spec` 不變（aqutter-js main 與 tag 仍在 `6a71990`）；baseline、dart 不變。兩個新 ref 的 pubspec 皆為 Flutter `>=3.50.0`、sdk `>=3.14.0 <4.0.0`。
- **[tag]** 使用者在對話中明說「現在處理」manifest 同步與移動 tag，視為授權強制推送 tag `0.0.0`。`aqutter_core` 的 tag 不再有後續變更，可於核准後直接移動；`aqutter`、`aqutter-cli` 的 tag 須等 manifest 與快照的 PR 合併後移到各自 main 最新（前幾輪同做法）。
- **[順序]** 序列：`aqutter` manifest 先合併，`aqutter-cli` 快照後合併。
- **[tag]** `aqutter_core` 的 tag `0.0.0` 已強制移到 `6aa0947`（舊 `911caa0`）。`aqutter`、`aqutter-cli` 的 tag 待各自 PR 合併後移到 main 最新。
- **[未驗證]** 全新專案的 `aqutter doctor` 端到端（需合併後）。

## Deviations
無。

## Impact Files
- `manifest/releases.json:17` — `shell.ref` → `f47a1f2b4029950284f119b03c4e6be6ab23367d`
- `manifest/releases.json:21` — `core.ref` → `6aa0947abb7cd694604d2c9ccb5d03c34f4c3705`
- `manifest/releases.json:3` — generatedAt 更新
