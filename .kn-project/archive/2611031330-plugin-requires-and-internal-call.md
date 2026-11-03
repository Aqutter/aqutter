# 2611031330 - plugin-requires-and-internal-call

- Created: 2026-11-03 13:30 / Archived: 2026-11-03
- Issue: N/A（本專案開發階段不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼新增 `AqutterPlugin.internal`（網頁不可直接呼叫）與 `AqutterPluginContext.callPlugin`（plugin 之間在 Dart 端直接呼叫），讓 plugin A 能封裝 plugin B 再暴露給網頁。`docs/plugins.md` 新增「相依其他 plugin」一節，說明 `requires`、單一版本規則與禁止循環。這是破壞性變更：實作 `AqutterPluginContext` 的類別（含測試 fake）必須補 `callPlugin`。

## Cross-Repo Scope
- 共用計畫 ID `2611031330-plugin-requires-and-internal-call`；各 repo 直接 `main`，兩者彼此獨立。
- `aqutter`（殼與文件，契約正本）、`aqutter-cli`（`requires` 的解析、連帶登記、版本檢查、`doctor`）。
- 收尾：`aqutter-plugins` 的 `location` 測試 fake 補 `callPlugin`（另 repo，未另開計畫，依使用者指示直接修）。

## Key Decisions
- **[隱藏 B]** Dart 端 A 呼叫 B，B 標 `internal` — A 的網頁端程式碼也經同一條 bridge 呼叫 B，在 bridge 層擋會連 A 一起擋掉。
- **[requires]** 套件名加 semver 範圍 — 一個 App 每個 plugin 只能有一個版本，需要範圍才能檢查相容。
- **[來源]** 連帶安裝取 A 的 `package.json` `dependencies[B]`，B 成為 App 直接依賴 — pnpm 不提升間接依賴，pubspec 用 `node_modules/<套件名>` 路徑。
- **[semver]** 自寫最小解析（`^`、`~`、精確版本），重用 `versioning.ts` 的 `satisfies` — 使用者選擇，不增加依賴。
- **[循環]** 不防護，文件禁止 — 開發階段無實例。
- **[宣告位置]** `internal` 只由 Dart 的 `AqutterPlugin.internal` 宣告，不放進描述檔 — CLI 不需要，單一來源。
- **[對齊]** shell `0.0.0` tag 移到功能提交 `b5f60fd`（與 manifest 記載一致）；`aqutter-cli` 的 tag 移到 `main` 最新。

## Deviations
- 無契約偏離；`aqutter-js` 不變、`client.spec` 不動。
- 驗證：`flutter analyze` 無問題；`flutter test` 263 個全過（含 `aqutterCallPlugin` 五種情況與 `internal` 預設值）。
- 未驗證：`_registerPlugins` 對 internal plugin 跳過網頁註冊的那段沒有單元測試（需要完整 WebView 與 bridge）；沒有真實的 A→B 雙 plugin 實機跑過。
- 破壞性變更：`location` 測試的 `_FakeContext` 要補 `callPlugin`，已修（`aqutter-plugins`）。

## Impact Files
- `shell/lib/src/plugin/aqutter_plugin.dart` — `internal`、`callPlugin`、`aqutterCallPlugin`、錯誤碼
- `shell/lib/src/bridge/bridge_registry.dart` — 跳過 internal 的 handler、`_PluginContext.callPlugin`
- `shell/lib/aqutter.dart` — 匯出新符號
- `shell/test/plugin_test.dart`、`shell/test/builtin_plugins_test.dart` — 測試與 fake
- `docs/plugins.md` — 相依其他 plugin
- `manifest/releases.json` — shell ref
