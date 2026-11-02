# 2611021026 - plugin-factories-and-per-plugin-files

- Created: 2026-11-02 10:26 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼的 plugin 清單現在可以放「工廠」：能帶參數、能非同步、能從啟動 context 取得偏好設定、支援目錄與平台，並在啟動流程內逐一解析。
動機是原本 CLI 產生的清單固定寫成 `HapticsPlugin()`，要給 plugin 帶參數只能在 `main.dart` 用濾掉再取代的寫法繞，而且建構當下拿不到任何非同步資源。`runAqutter` 的 `plugins` 型別放寬，既有的寫法不用改。影響 `aqutter` 殼的 plugin 介面與啟動流程、文件與 wiki；CLI 與範例 App 在各自 repo 的同名計畫。

## Cross-Repo Scope
- **共用計畫 ID**: `2611021026-plugin-factories-and-per-plugin-files`；無共用分支，各 repo 直接 `main`。
- `aqutter` — 介面、解析、文件、wiki（契約正本，本 repo）。
- `aqutter-cli` — 產生總清單與每個 plugin 的使用者檔案。
- `aqutter-nuxt-app` — 範例 App 遷移與驗證。
- 執行順序：契約凍結後殼與 CLI 平行；範例 App 需等兩者 push 並更新 manifest；發佈順序殼、CLI、範例 App。

## 契約（只留引用）
契約正本是 `docs/plugins.md` 與 `shell/lib/src/plugin/plugin_entry.dart`，最終修訂號 rev 1（2026-11-02 凍結，之後無變更）。要點：
- `AqutterPluginEntry`（`AqutterPlugin` 與 `AqutterPluginBuilder` 的共同超型別）、`AqutterPluginFactory`（`FutureOr<AqutterPlugin> Function(AqutterBootContext)`）、`AqutterBootContext`（`preferences`、`supportDirectory`、`platform`）。
- 解析在啟動流程內、建立 bridge 之前，依清單順序逐一，每個工廠最長 30 秒；任何一個失敗整個啟動失敗，錯誤畫面指出是哪個 plugin。
- CLI 產生物：總清單 `lib/aqutter_plugins.dart`（每次重寫）與每個 plugin 一個 `lib/plugins/<id>_plugin.dart`（只建立、永不覆蓋）；`plugin remove` 預設保留該檔、`--purge` 才刪。

## Key Decisions
- **[相容]** `AqutterPlugin` 與 `AqutterPluginBuilder` 共用超型別，`plugins` 參數放寬；既有 App 的 `main.dart` 不用改（使用者選擇）。
- **[流程]** 直接 main、不建 issue（使用者選擇）。
- **[啟動 context]** 只提供 `preferences`、`supportDirectory`、`platform`；env 用 `const String.fromEnvironment` — 編譯期常數不需要 context，其他資源等有實際需求再加（新增成員是相容的）。
- **[失敗政策]** 工廠丟例外或逾時整個啟動失敗並指出是哪個 plugin — 靜默略過會讓人以為功能壞了。
- **[解析時機]** 在 `_bootstrap` 內（有錯誤畫面），不在 `runApp` 之前 — runApp 之前失敗沒有畫面可顯示。
- **[使用者檔案]** 每個 plugin 一個檔案，CLI 只建立不覆蓋；`remove` 預設保留 — 裡面是使用者的設定，誤刪的代價高於留下一個檔案。
- **[不做]** widget 樹的 `BuildContext`、全域註冊器 — 建構時沒有 widget 樹；全域可變狀態不易測試且順序不確定。
- **[`AqutterPluginEntry` 放在 `aqutter_plugin.dart`]** 避免與 `plugin_entry.dart` 的循環匯入。

## Deviations
- 無契約變更。
- **驗證範圍**：工廠失敗的錯誤畫面只由 widget 測試涵蓋，沒有在手機上製造失敗；成功路徑已用 Android 實機驗證（五個 plugin 以新註冊方式編譯並運作，地圖 plugin 套用範例客製）。

## Impact Files
- `shell/lib/src/plugin/plugin_entry.dart`（new）— 介面、工廠、啟動 context、解析函式 `resolvePluginEntries`
- `shell/lib/src/plugin/aqutter_plugin.dart:100`（`AqutterPlugin`）— `implements AqutterPluginEntry`，並定義該介面
- `shell/lib/src/app.dart`（`runAqutter`、`AqutterApp`、`AqutterPage`、`_bootstrap`）— 型別放寬、啟動內解析、畫面上的 plugin 讀解析後的 state
- `shell/lib/aqutter.dart` — 匯出新型別
- `shell/test/plugin_entry_test.dart`（new）— 順序、混用、逐一執行、context、逾時、例外、舊寫法、錯誤畫面
- `docs/plugins.md`（新增建立 plugin 與檔案分工）、`docs/cli.md`（plugin 指令）
- `.kn-project/wiki/platform/plugin-registration.md`（new）、`index.md`
- `manifest/releases.json` — shell ref 跟版

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/plugin-registration.md` | 2026-11-02 | — | plugin 清單可放工廠，能帶參數與非同步並取得啟動 context | — | — |
