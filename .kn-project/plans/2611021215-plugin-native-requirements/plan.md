# Plan: 2611021215 - plugin-native-requirements
- Created: 2026-11-02
- Branch: N/A（直接 main）
- Issue: N/A（無 issue 追蹤基準）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
外部 plugin 常需要使用者在原生專案補權限與 Info.plist 說明文字（例如生物辨識、定位、存相簿），目前只靠各 plugin 的 README。讓 plugin 在描述檔宣告這些需求，由 CLI 在 `plugin add` 時提示、在 `aqutter doctor` 檢查缺漏；CLI 不改使用者的原生檔。這是後續生物辨識、定位、存到手機等外部 plugin 的前提。

## Architecture
shell 不動；本 repo 是契約正本：`docs/plugins.md` 與 wiki 寫入新欄位，`docs` 列出首批採用者的原生需求。 描述檔新增選填 `native.features`，使用者可選擇啟用的功能（`features`），只檢查所選功能的需求。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611021215-plugin-native-requirements`　**共用分支名**: N/A（直接 main）
- **參與 repo**: `aqutter`（契約正本、文件、wiki）、`aqutter-cli`（解析與檢查）
- **執行順序相依**: 契約凍結後兩者可平行；發佈順序 aqutter 先、aqutter-cli 後。
- **後續（不在本計畫）**: 首批外部 plugin（安全儲存、生物辨識、定位、存到手機）各自新 repo，需等契約凍結與 CLI 發佈；repo 的建立屬對外動作，另行請示。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-02）`

### 1. 描述檔新增欄位 `native`（選填；沒有則視為不需要任何原生設定）
```json
{
  "schema": 1,
  "id": "biometrics",
  "dart": { "package": "aqutter_plugin_biometrics", "class": "BiometricsPlugin" },
  "native": {
    "features": {
      "unlock": {
        "android": { "permissions": [{ "name": "android.permission.USE_BIOMETRIC" }] },
        "ios": { "infoPlist": { "NSFaceIDUsageDescription": "Use Face ID to unlock the app" } },
        "note": "Android 的 MainActivity 必須繼承 FlutterFragmentActivity"
      }
    }
  }
}
```

### 2. 欄位
| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `native.features` | 物件，key 是功能名（`^[a-z][a-z0-9-]*$`） | 是（有 `native` 時） | 一個 plugin 可有多個功能，各自宣告 |
| `<feature>.android.permissions[]` | `{ name: string, maxSdkVersion?: integer }` | 否 | 要在 `AndroidManifest.xml` 有的 `uses-permission`；`name` 必須是 `android.permission.*` 或含 `.` 的完整名稱 |
| `<feature>.ios.infoPlist` | `Record<string, string>` | 否 | 要在 `Info.plist` 有的鍵；值是**建議文字**，使用者可改，只檢查鍵存在且非空 |
| `<feature>.macos.infoPlist` | 同上 | 否 | `macos/Runner/Info.plist` |
| `<feature>.note` | string | 否 | 無法機器檢查的要求，只顯示給人看 |

### 3. 使用者選擇功能
- `aqutter.config.json` 的 plugin 項目新增選填 `features: string[]`；省略代表「全部功能」。
- `aqutter plugin add <來源> --features a,b`；沒有這個旗標就是全部。
- 描述檔沒有 `native`，或 `features` 的名稱不在描述檔宣告內，`plugin add` 失敗並列出可用名稱。

### 4. CLI 行為
- `plugin add` 成功後印出「還需要補的原生設定」清單（缺哪個權限、哪個 plist 鍵、建議文字、note）；全部已具備則不印。
- `aqutter doctor` 逐一檢查已登記 plugin 所選功能的宣告，缺漏列為警告並附確切內容。
- **CLI 不修改 `AndroidManifest.xml`、`Info.plist`**（只讀）。

### 5. 相容性
- 沒有 `native` 的既有 plugin（haptics、battery、google-maps、mirror-demo、sqlite-drift）行為完全不變。
- 未知的 `native` 子欄位被忽略但不報錯，以便日後擴充；`schema` 維持 1。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `docs/plugins.md:20`（描述檔欄位表）— 新增 `native` 與 `features` 說明
- `docs/plugins.md:204`（plugin add 範例段）— `--features` 與提示輸出
- `docs/cli.md` — plugin add 與 doctor 的行為
- `.kn-project/wiki/platform/plugin-registration.md` — 原生需求的宣告與檢查現況
- `.kn-project/wiki/platform/permissions.md` — 外部 plugin 的權限宣告
- `manifest/releases.json` — 跟版（CLI 發佈後）

## Open Questions / 待確認事項
### Q1. 功能選擇的預設 — 影響範圍：`plugin add`、`aqutter.config.json`
- [x] 省略 `--features` 代表全部功能（建議：與現有 plugin 行為一致，需求寫得多只是多一次提示）
- [ ] 省略時要求使用者明確指定
- **決議**：已確認　狀態：✅ 已確認

### Q2. doctor 缺漏的等級 — 影響範圍：`aqutter doctor`
- [x] 警告（建議：原生檔是使用者的，且建置不會因此失敗，執行時才會出問題）
- [ ] 錯誤
- **決議**：已確認　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
無

## Key Decisions
- **[Q1]** 省略 `--features`＝全部功能。
- **[Q2]** doctor 缺漏為警告。
- **[原生設定]** 宣告＋doctor 檢查，CLI 不改使用者的原生檔 — 理由：使用者已改過的 XML／plist 難以安全編輯與還原（使用者選擇）。
- **[範圍]** 第一批含網路狀態、安全儲存、生物辨識、定位、存到手機；網路狀態查證後殼已內建（`BridgeEvent.network` 與查詢 handler），不需新做；其餘四個 plugin 等本契約凍結與 CLI 發佈後各自在新 repo 規劃。
- **[流程]** 直接 main、不建 issue（使用者於核准閘確認）。

## Git Completion Policy
- commit 自動；push／PR 依核准閘選項。

## References
- `aqutter/docs/plugins.md`、`aqutter-cli/src/plugins.ts`
