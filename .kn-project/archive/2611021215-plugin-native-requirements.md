# 2611021215 - plugin-native-requirements

- Created: 2026-11-02 12:15 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
plugin 現在可以在描述檔宣告各功能需要使用者在原生專案補的權限與說明文字鍵，CLI 在加入 plugin 時印出還缺的設定、診斷指令列為警告；CLI 只讀、不修改使用者的原生檔。使用者可只選用部分功能，省略代表全部。動機是後續的生物辨識、定位、存到手機等外部 plugin 需要原生設定，過去只靠各 plugin 的 README。本 repo 負責契約文件與 wiki。

## Cross-Repo Scope
- **共用計畫 ID**: `2611021215-plugin-native-requirements`；無共用分支，各 repo 直接 `main`。
- `aqutter`（契約正本、文件、wiki）與 `aqutter-cli`（解析、提示、檢查）；發佈順序 aqutter 先、aqutter-cli 後。

## 契約（只留引用）
正本是 `aqutter` 的 `docs/plugins.md`「宣告原生設定」，修訂號 rev 1（2026-11-02 凍結，無變更）。要點：描述檔選填 `native.features`；每個功能可宣告 Android 權限、iOS／macOS 的 Info.plist 鍵與 note；`--features` 省略＝全部；缺漏為警告；CLI 不改原生檔；未知子欄位忽略。

## Key Decisions
- **[原生設定]** 宣告＋doctor 檢查，CLI 不改使用者的原生檔 — 使用者已改過的 XML／plist 難以安全編輯與還原（使用者選擇）。
- **[功能選擇預設]** 省略 `--features`＝全部功能 — 與現有 plugin 行為一致。
- **[doctor 等級]** 缺漏為警告 — 建置不受影響，執行時才出問題，原生檔屬於使用者。
- **[範圍]** 網路狀態殼已內建（先前誤判為缺少），不需新做；安全儲存、生物辨識、定位、存到手機四個外部 plugin 等本契約發佈後各自在新 repo 規劃（建 repo 屬對外動作，另行請示）。
- **[流程]** 直接 main、不建 issue。

## Deviations
- 無契約變更。
- 契約寫 `--features a,b`（空白寫法），CLI 的參數解析只認 `--key=value`，所以在 `plugin add` 內先把 `--features a,b` 併成 `--features=a,b`；兩種寫法都可用。
- 驗證範圍：解析、選擇、需求合併、原生檔比對與診斷等級有單元測試，既有範例專案跑 `doctor --offline` 無異常；`plugin add` 印出缺漏的完整流程沒有用真實 plugin 端對端跑過。
- manifest 未動：殼程式沒有變更，只有文件。

## Impact Files
- `docs/plugins.md`（新增「宣告原生設定」）、`docs/cli.md`（plugin add 旗標與 doctor 檢查項）
- `.kn-project/wiki/platform/plugin-registration.md`、`permissions.md` — 現況同步

## Wiki Changes

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/plugin-registration.md` | 2026-11-02 | — | plugin 可宣告原生權限需求，CLI 檢查但不代改 | — | — |
| `platform/permissions.md` | 2026-11-02 | — | plugin 可宣告原生權限需求，CLI 檢查但不代改 | — | — |
