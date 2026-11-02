# 2611021125 - deeplink-options

- Created: 2026-11-02 11:25 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
內建 `deeplink` plugin 現在可由 App 在 `AqutterConfig.deepLink` 設定連結的 scheme／主機白名單與轉換函式，網頁只會收到 App 認可且已轉成網頁路由形態的連結。不設定時行為與之前完全相同。動機是 scheme、網域與連結導向屬於各 App，原本殼只能原樣轉交。影響 `aqutter` 殼的 deeplink plugin、設定與文件；範例 App 未留下變更。

## Cross-Repo Scope
無（單一 repo）。

## 契約（只留引用）
無（單一 repo）。選項介面見 `shell/lib/src/plugins/deeplink/deep_link_options.dart`。

## Key Decisions
- **[自訂方式]** 帶選項，不開放整個 plugin 替換 — 保留 id 與單一註冊路徑，相容性風險最小。
- **[選項內容]** `allowedSchemes`、`allowedHosts`、`transform` — 涵蓋白名單與路由轉換兩個常見需求；null 代表不限制。
- **[順序]** 白名單 → 轉換；`initial` 與事件共用同一條管線；被丟棄的啟動連結讓 `initial` 回 null。
- **[去重]** 「串流重送啟動連結」以原始連結比較 — 轉換後的值與串流送來的原始值不會相等。
- **[流程]** 直接 main、不建 issue。

## Deviations
- 無契約變更。
- 實機驗證時範例 App 暫時接上選項（只允許 `aqutterdemo://open`，轉成 `/open`），驗證完已還原，範例 App 沒有留下設定。
- 驗證的是 Android；iOS 與 macOS 走同一段 Dart 管線，但沒有實機驗證。
- 計畫的 manifest 跟版指向功能 commit；`0.0.0` tag 未移動。

## Impact Files
- `shell/lib/src/plugins/deeplink/deep_link_options.dart`（new）— 選項與套用規則
- `shell/lib/src/plugins/deeplink/deep_link_service.dart`（`DeepLinkService`）— 過濾與轉換管線、去重
- `shell/lib/src/plugins/deeplink/deeplink_plugin.dart`、`builtin_plugins.dart`、`shell/lib/src/bridge/bridge_registry.dart`、`shell/lib/src/app.dart` — 選項傳遞
- `shell/lib/src/aqutter_config.dart`（`AqutterConfig.deepLink`）、`shell/lib/aqutter.dart` — 設定欄位與匯出
- `shell/test/deep_link_service_test.dart` — 選項與管線測試
- `docs/native-features.md`、`.kn-project/wiki/platform/native-features.md` — 文件
- `manifest/releases.json` — shell ref 跟版

## Wiki Changes

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/native-features.md` | 2026-11-02 | — | 深層連結可在殼層設定白名單與轉換 | — | — |
