# 2610221548-plugin-supported-platforms-and-multiplatform-map

- Created: 2026-10-22 15:48 / Archived: 2026-10-22 17:30
- Issue: Aqutter/aqutter#12
- Milestone: N/A / Base Branch: main

## Summary
殼讓 plugin 宣告自己支援的平台：`AqutterPlugin.supportedPlatforms`（預設 null＝所有平台）。不支援的平台上，handler 仍註冊但不列入 `capabilities`（網頁用同步的 `isPluginSupported` 分支）、殼不呼叫 `attach`／`buildUnderlay`／`buildOverlay`，被呼叫時回傳 `{ aqutterError: { code: UNSUPPORTED_PLATFORM, … } }`，由 `aqutter-js` 的 `callPlugin` 轉成 `AqutterPluginError`。這是「google-maps 多平台（原生＋Google Maps JS）」的前置，契約正本在本計畫（rev 2）。

## Cross-Repo Scope
- `Aqutter/aqutter`（本 repo，契約正本）— 殼的宣告機制。
- `Aqutter/aqutter-js`（`Aqutter/aqutter-js#1`、PR #2）— `callPlugin` 轉換 `aqutterError`。
- `Aqutter/aqutter-plugin-google-maps`（`Aqutter/aqutter-plugin-google-maps#3`）— 多平台地圖，依賴本計畫與 aqutter-js。

## Key Decisions
- **[Q1]** 宣告粒度＝plugin 層級的 `supportedPlatforms`（建議項）。
- **[契約 rev 2]** 不支援平台的呼叫回傳 `aqutterError` 資料、`aqutter-js` 轉成拋出 — 理由：例外傳遞依賴各原生平台，無法逐一驗證；殼的慣例本來就是回傳錯誤資料。使用者於 2026-10-22 核准（原 rev 1 預期「先實測例外傳遞」）。
- **[完成後]** commit + 開 PR。

## Deviations
- 契約由 rev 1 改為 rev 2（Rule 29）：原本第 3 點「handler 回傳錯誤、網頁 Promise reject」改為錯誤資料；`aqutter-js` 從「只改註解」變成要改程式碼並加測試。

## Details
- 驗證：`flutter analyze` No issues found、`flutter test` 90 個全過（新增 4 個 `aqutterPluginSupports`／`aqutterErrorPayload` 測試）。
- 未驗證：`BridgeRegistry` 註冊路徑本身（handler 替換、不呼叫 `attach`）沒有直接的單元測試，因為建構它需要很多相依；只有輔助函式被測試。需要在實機以一個宣告了 `supportedPlatforms` 的 plugin 驗證（google-maps 計畫的最後一個任務會做）。
- 合併後的人工收尾：manifest 的 `shell.ref`、移動 tag `0.0.0`、同步 `aqutter-cli` 快照，範本專案跑 `flutter pub upgrade aqutter aqutter_core`。
