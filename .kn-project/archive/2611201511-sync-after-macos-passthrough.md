# 2611201511-sync-after-macos-passthrough

- Created: 2026-11-20 15:11 / Archived: 2026-11-20 15:12
- Issue: Aqutter/aqutter#82
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 前進到 macOS 穿透合併之後（`core.ref` → `89ef85e`、`generatedAt`），並讓 `docs/nativeview.md` 的 `auto` 平台說明包含 macOS。
CI 的 manifest-check（schema 驗證與 ref／Flutter 基準交叉檢查）本機重現通過。上游 `aqutter_core` 的 `0.0.0` tag 已移到 main；`aqutter` 自己的 tag 在合併後移動。

## Cross-Repo Scope
- 計畫共用 ID `2611201511-sync-after-macos-passthrough`、共用分支名 `feature/2611201511-sync-after-macos-passthrough`；參與：`aqutter`（`Aqutter/aqutter#82`，manifest 與文件，契約正本）、`aqutter-cli`（內建快照）、`aqutter-nuxt-app`（鎖定前進，不開 PR）；上游 `aqutter_core` 只移動 `0.0.0` tag。
- 執行順序：上游 tag → `aqutter` 合併 → `aqutter` tag → `aqutter-cli` 合併 → `aqutter-cli` tag → `aqutter-nuxt-app` 鎖定與 tag。契約：正本 `aqutter`（`manifest/releases.json` schema 1，rev 1），快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`、`aqutter-nuxt-app`；來源是 `aqutter_core` 計畫 `2611201345-macos-passthrough` 留下的人工收尾事項，使用者回覆「都做」。
- **[Milestone]** 不指定，base `main`。
- **[tag]** `0.0.0` 是浮動 tag；使用者核准移動並要求記舊值：`aqutter_core` `671bef98208069983843c2f9517b8e3098b9b4cc` → `89ef85e3b6afa8d3ae50b5bc39012d60a668f024`；`aqutter` 舊值 `e4f7d91`、`aqutter-cli` 舊值 `09b8657`、`aqutter-nuxt-app` 舊值 `02234a3`，各自合併或推送後移動。
- **[完成後]** `aqutter`、`aqutter-cli` commit + 開 PR；`aqutter-nuxt-app` 依其 `project.md` 直接推 `main`。

## Deviations
無偏離計畫。wiki 沒有寫死平台清單（已檢視 `platform/architecture.md`、`platform/webview-transparency.md`），不需修改。

## Impact Files
- `manifest/releases.json:3,20` — `generatedAt`、`core.ref`
- `docs/nativeview.md:94` — `auto` 的平台說明加入 macOS
