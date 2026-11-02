# 2610291654 - plugin-permission-hook

- Created: 2026-10-29 16:54 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
權限統一由殼處理：網頁的權限 handler 與 plugin 都向殼的權限服務查詢與要求權限，並新增可設定的 WebView 授權放行清單。
起因是使用者要求把相機做成 plugin，盤點後相機是純網頁功能（`getUserMedia` 加掃碼函式庫），沒有原生程式，不需要 plugin；真正的缺口是 plugin 沒有權限入口，只能各自相依權限套件而繞過殼。影響 `aqutter` 殼的 plugin 介面、權限服務與設定。

## Cross-Repo Scope
無（單一 repo）。完成後需同步 manifest 的殼 ref 並移動 tag；不影響 `aqutter-js`、`aqutter-cli` 與既有 plugin（純加法）。

## Key Decisions
- **[流程]** 單一 repo、直接 main、不建 issue 與 milestone — `project.md` 的開發階段規則。
- **[方向]** 權限由殼統一處理，plugin 與網頁都向殼要（使用者 2026-10-29）。
- **[不做相機 plugin]** 相機是純網頁功能。
- **[取消]** plugin 的 WebView 授權鉤子 — 目前沒有使用者，且會把決定權分散到 plugin，與統一處理相悖。
- **[Q2]** plugin context 提供系統層權限方法 — 使用者確認一併做。
- **[預設]** WebView 預設政策沿用現行：自家來源放行相機與麥克風，行為不變。

## Deviations
無。執行中另有一個結論：Windows 上相機的兩個 WebView2 原生層訊息（來自 `aqutter_core`）與權限程式無關，是另一條線索，未在本計畫處理。

## Impact Files
- `shell/lib/src/plugin/aqutter_plugin.dart:61`（`AqutterPluginContext`）— 新增 `checkPermission`、`requestPermission`、`openPermissionSettings`
- `shell/lib/src/bridge/permission_service.dart`（new）— `AqutterPermissions`，可注入
- `shell/lib/src/bridge/bridge_registry.dart`（`_registerPermissions`、`_PluginContext`）— 網頁 handler 改走服務，context 實作三個方法
- `shell/lib/src/bridge/media_permission.dart:16`（`decideMediaPermission`）— 新增 `allowed` 參數
- `shell/lib/src/app.dart`（`onPermissionRequest`）— 傳入放行清單
- `shell/lib/src/aqutter_config.dart` — `webPermissions`（預設相機、麥克風、兩者）
- `shell/test/permission_service_test.dart`（new）、`plugin_test.dart`、`media_permission_test.dart`
- `docs/plugins.md`（新增「權限」一節）、`docs/android.md`
- `.kn-project/wiki/platform/permissions.md`（new）、`index.md`

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/permissions.md` | 2026-11-02 | — | 權限由殼統一處理，網頁與 plugin 共用權限服務與 WebView 授權放行清單 | — | — |
