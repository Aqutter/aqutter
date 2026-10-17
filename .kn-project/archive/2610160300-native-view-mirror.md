# 2610160300 - native-view-mirror

- Created: 2026-10-16 / Archived: 2026-10-16
- Issue: N/A
- Milestone: N/A / Base Branch: main

## Summary
`aqutter` 0.2.0：加入 native view 鏡像的網頁端（`<aqutter-native>` 自訂元素、`AqutterNative`、手勢辨識與幀解碼）、bridge handler `native_endpoint`，以及 plugin 的 underlay slot（`buildUnderlay`）；shell 改依賴 `aqutter_core` 0.2.0 並重新匯出鏡像 API。範例 plugin 另立 repo（haptics、battery、mirror-demo）。
直接推送 `main`，未使用 issue、PR、milestone 或版本分支。

## Cross-Repo Scope
`Aqutter/aqutter_core` 0.2.0（原生端與 Dart 鏡像）。

## Key Decisions
- 元素類別延遲建立（`defineAqutterNative()` 內），使 `import '@aqutter/aqutter'` 在 SSR 下安全。
- 手勢在網頁端辨識、以 0..1 正規化座標回傳，原生端不需處理指標細節。
- 連線資訊（埠與令牌）經 bridge handler 取得，不寫死埠號。

## Deviations
- 驗證範圍見 `project.md`；實機（iOS／Android）上的原生擷取尚未驗證。

## Impact Files
- `client/src/nativeview/**`、`client/src/index.ts`、`client/src/contract/{bridge,table}.ts`、`client/test/**`、`shell/lib/src/bridge/**`、`shell/lib/src/plugin/aqutter_plugin.dart`、`shell/lib/src/app.dart`、`shell/lib/aqutter.dart`、`shell/pubspec.yaml`、`docs/nativeview.md`、`docs/plugins.md`

## 0.2.1
- 修正：CLI 範本內的 `.gitignore`（含各平台目錄與 plugin 範本）被 npm 打包排除，GitHub 安裝的 CLI 展開後缺少忽略規則。改以 `_gitignore` 存放並於展開時還原；App 範本補上 Flutter 產生檔（ephemeral、Generated.xcconfig、plugin registrant 等）的忽略規則。
