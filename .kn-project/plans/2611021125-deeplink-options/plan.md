# Plan: 2611021125 - deeplink-options
- Created: 2026-11-02
- Branch: N/A（直接 main）
- Issue: N/A（無 issue 追蹤基準，沿用本 repo 慣例）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
內建 `deeplink` plugin 目前把所有連結原樣交給網頁。讓 App 可以在 `runAqutter(config: AqutterConfig(deepLink: …))` 設定連結的接受範圍與轉換，網頁只會收到「App 認可、且已轉成網頁路由形態」的連結。不設定時行為與現在完全相同。

## Architecture
- 新增 `DeepLinkOptions`：`allowedSchemes`、`allowedHosts`（null＝不限制）、`transform`（`String? Function(String url)`，回 null＝丟棄）。
- 處理順序：scheme／host 過濾 → transform → 送出。`initial` 與事件 `received` 套同一條管線；啟動連結被丟棄時 `initial` 回 null。
- 去重（第一筆等於啟動連結）以「原始連結」比較，在過濾之前，避免轉換後不相等而重送。
- 選項放 `AqutterConfig.deepLink`（與既有 `webPermissions` 同一模式），由 `AqutterPage` 傳進 `BridgeRegistry` → `builtinPlugins` → `DeeplinkPlugin`。
- 不做：整個 plugin 可替換（保留 id 規則不變）；iOS／Android 的 scheme 宣告仍由使用者寫原生專案。

## Cross-Repo Scope
無（單一 repo）

## Contract / 介面契約
無（單一 repo）

## Impact Files
- `shell/lib/src/aqutter_config.dart:32`（`AqutterConfig`、`webPermissions` 為先例）— 新增 `deepLink` 欄位
- `shell/lib/src/plugins/deeplink/deep_link_service.dart:34`（`DeepLinkService`）— 過濾與轉換管線
- `shell/lib/src/plugins/deeplink/deeplink_plugin.dart:10`（`DeeplinkPlugin`）— 接收選項
- `shell/lib/src/plugins/builtin_plugins.dart:17`（`builtinPlugins`）— 傳遞選項
- `shell/lib/src/bridge/bridge_registry.dart:41`（`BridgeRegistry` 建構子）— 傳遞選項
- `shell/lib/src/app.dart:353`（建立 `BridgeRegistry` 處）— 從 config 帶入
- `shell/lib/aqutter.dart:6` — 匯出 `DeepLinkOptions`
- `shell/test/deep_link_service_test.dart` — 過濾、轉換、丟棄、去重、`initial` 一致性
- `docs/native-features.md:117`（深層連結段）— 選項與範例
- `.kn-project/wiki/platform/native-features.md` — 同步現況
- `manifest/releases.json` — shell ref 跟版

## Open Questions / 待確認事項
### Q1. 自訂方式 — 影響範圍：`AqutterConfig`、deeplink plugin
- [x] 帶選項（建議）
- **決議**：帶選項　狀態：✅ 已確認

### Q2. 選項內容 — 影響範圍：`DeepLinkOptions`
- [x] `allowedSchemes`＋`allowedHosts`＋`transform`（建議：涵蓋白名單與路由轉換兩個常見需求）
- [ ] 只做 `transform`（一個函式可寫出所有規則，但常見白名單要自己寫）
- **決議**：白名單＋transform　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
無

## Key Decisions
- **[Q1]** 帶選項，不開放整個 plugin 替換 — 理由：保留 id 與單一註冊路徑不變，相容性風險最小。
- **[Q2]** 白名單＋transform — 理由：涵蓋過濾與路由轉換兩個常見需求。
- **[流程]** 直接 main、不建 issue（使用者於核准閘確認）。

## Git Completion Policy
- commit 自動；push／PR 依核准閘選項。

## References
- `docs/native-features.md`、`.kn-project/archive/` 中內建 plugin 計畫
