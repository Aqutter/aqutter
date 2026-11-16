# 2611161111 - resync-manifest-core

- Created: 2026-11-16 11:11 / Archived: 2026-11-16 11:40
- Issue: Aqutter/aqutter#65
- Milestone: N/A / Base Branch: main

## Summary
把 manifest 的 `core.ref` 同步到 aqutter_core 目前的 `522669e`（含 PR #30 的 Windows `window` 棄用修正），讓 `aqutter doctor` 不再對鎖在該 commit 的專案警告「框架記載 6aa0947」。

驗證：本機重現 CI `manifest-check`——ajv schema 通過；shell.ref 仍等於 `git log -1 --format=%H -- shell`（`f47a1f2`）；新 core ref 與 shell ref 的 pubspec 皆為 sdk `>=3.14.0 <4.0.0`；client 提交 `6a71990` 存在。doctor 端到端需合併後。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方）、aqutter-cli（快照，消費方）。共用 ID `2611161111-resync-manifest-core`、共用分支 `feature/2611161111-resync-manifest-core`；issue：aqutter#65、aqutter-cli#38。順序：aqutter 先合併，aqutter-cli 後合併。契約 rev 1（只改 `core.ref` 與 `generatedAt`），無變更。

## Key Decisions
- **[Phase 0]** 目標 repo `aqutter` 與 `aqutter-cli`；證據：`aqutter-nuxt-app` 鎖到 `522669e` 後 doctor 警告「框架記載 6aa0947」，來源 `manifest/releases.json:21`；aqutter_core 的 tag 已在 `522669e`，不動。
- **[Phase 0]** Milestone：不指定（使用者回答，兩個 repo 各問一題）；Base Branch = `main`；遠端無 dev 類分支。
- **[範圍]** 只更新 `core.ref` 與 `generatedAt`：`shell.ref` 與 `client.spec` 仍正確。
- **[契約]** rev 1 凍結；**[順序]** aqutter 先、aqutter-cli 後；**[完成後]** commit + 開 PR。
- **[未驗證]** 全新專案的 `aqutter doctor` 端到端（需合併後）；tag `0.0.0` 的移動待使用者明說。

## Deviations
無。

## Impact Files
- `manifest/releases.json:3` — `generatedAt` 更新
- `manifest/releases.json:21` — `core.ref` → `522669e95b880318940e93b9a78a0ea940d00666`
