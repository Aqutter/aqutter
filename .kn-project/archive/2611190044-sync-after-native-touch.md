# 2611190044-sync-after-native-touch

- Created: 2026-11-19 00:44 / Archived: 2026-11-19 00:46
- Issue: Aqutter/aqutter#80
- Milestone: N/A / Base Branch: main

## Summary
把 `manifest/releases.json` 同步到 iOS 原生觸控合併後的主幹（`shell.ref` → `e39621f`、`core.ref` → `671bef9`、`client.spec` → `#a4ad506`、`generatedAt`），並把 `docs/nativeview.md` 的穿透說明更新為目前行為（iOS 觸控直接進原生、`webRegions`、plugin 要做的事）。
CI 的 manifest-check（schema 驗證、ref 存在、`shell.ref` 等於 `git log -1 -- shell`、Flutter 基準）本機重現通過。上游 `aqutter_core`、`aqutter-js` 的 `0.0.0` tag 已移到各自 main；`aqutter` 自己的 tag 在合併後移動。

## Cross-Repo Scope
- 計畫共用 ID `2611190044-sync-after-native-touch`、共用分支名 `feature/2611190044-sync-after-native-touch`；參與：`aqutter`（`Aqutter/aqutter#80`，manifest 與文件，契約正本）、`aqutter-cli`（`Aqutter/aqutter-cli#48`，內建快照）、`aqutter-nuxt-app`（鎖定前進，不開 PR）；上游 `aqutter_core`、`aqutter-js` 只移動 `0.0.0` tag。
- 執行順序：上游 tag → `aqutter` 合併 → `aqutter` tag → `aqutter-cli` 合併 → `aqutter-cli` tag → `aqutter-nuxt-app` 鎖定。契約：正本 `aqutter`（`manifest/releases.json` schema 1，rev 1），快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`、`aqutter-nuxt-app`；來源是前一份計畫 `2611172358-ios-passthrough-drag-jitter` 留下的人工收尾事項，使用者回覆「都做」。
- **[Milestone]** 不指定，base `main`。
- **[tag]** `0.0.0` 是浮動 tag；使用者明確核准移動，並要求記下舊值：`aqutter_core` `84d9174…`、`aqutter-js` `3f250d6…`、`aqutter` `bab2f0b…`、`aqutter-cli` `2710dce…`。
- **[完成後]** `aqutter`、`aqutter-cli` commit + 開 PR；`aqutter-nuxt-app` 依其 `project.md` 直接推 `main`。

## Deviations
無偏離計畫。wiki 沒有需要修改的頁面（已檢視 `platform/architecture.md`、`webview-transparency.md`，前者的協定列已在前一份計畫更新）。

## Impact Files
- `manifest/releases.json:3,15,20,23` — `generatedAt`、`shell.ref`、`core.ref`、`client.spec`
- `docs/nativeview.md:94`（`auto` 的平台說明）、`:100-101` 附近（穿透模式清單）— 移除「iOS 實機未驗證」、新增「iOS 的觸控直接進原生」與「寫原生 UI 的 plugin 要知道的事」
