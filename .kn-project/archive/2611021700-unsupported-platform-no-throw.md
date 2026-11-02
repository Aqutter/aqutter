# 2611021700 - unsupported-platform-no-throw

- Created: 2026-11-02 17:00 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼配合新契約：`platform_info` 多回報 `dev`（連 dev server 或 debug 建置），debug 建置時對不支援的 plugin 呼叫在日誌留一行；傳輸語意不變。文件與 wiki 說明新行為，發佈清單的殼與 client 版本跟版。

## Cross-Repo Scope
- **共用計畫 ID**: `2611021700-unsupported-platform-no-throw`；各 repo 直接 `main`。
- 參與 repo：`aqutter-js`（契約正本）、`aqutter`（殼）、`aqutter-plugins`（官方 plugin 的網頁 API）、`aqutter-nuxt-app`（範例 App 與驗證）。

## 契約（只留引用）
正本是 `aqutter-js` 的 `src/index.ts`（`callPluginRaw`／`callPlugin`）與 `src/contract/models/platform.ts`（`PlatformInfo.dev`），修訂號 rev 1（2026-11-02 凍結，無變更）。要點：平台不支援（`UNSUPPORTED_PLATFORM`）、App 沒裝該 plugin（`HANDLER_NOT_FOUND`）、不在 Flutter 內，三種情況 `callPlugin` 回 `undefined` 不拋錯；其餘錯誤照舊拋出；`platform_info.dev` 為 true 時才在 console 警告一次，正式版安靜；回傳型別 `Res | undefined`。

## Key Decisions
- **[行為]** 不支援的平台回 `undefined`、型別改 `Res | undefined`（使用者選擇）。
- **[沒裝 plugin]** 也回 `undefined` — 網頁包 OTA 更新與殼版本可能落差，編譯期抓不到；開發階段警告補償。
- **[純瀏覽器]** 也回 `undefined`。
- **[警告]** 只在開發階段（`dev`），`console.warn` 一次性；正式版完全安靜。
- **[傳輸不變]** 殼仍回 `UNSUPPORTED_PLATFORM`，轉換只在網頁端，新舊殼與新舊網頁端任意組合都能運作。
- **[流程]** 直接 main、不建 issue。

## Deviations
- 殼端 `dev` 的回報只有判斷函式的單元測試，沒有端對端驗證（沒有 debug 建置環境）。
- aqutter 的 `0.0.0` tag 移到新殼（`c17d588`）。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart`（`bridgeDevMode`、`unsupportedPluginCallMessage`、`_platformInfo`）
- `shell/test/unsupported_call_test.dart`（new）
- `docs/plugins.md`、`docs/native-features.md`、`.kn-project/wiki/platform/native-features.md`
- `manifest/releases.json`（shell ref、client spec）

## Wiki Changes

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/native-features.md` | 2026-11-02 | — | 不支援的平台呼叫回 undefined，開發階段才警告 | — | — |
