# 2611031115 - remove-builtin-picker-pick

- Created: 2026-11-03 11:15 / Archived: 2026-11-03
- Issue: N/A（本專案開發階段不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼移除內建 `picker_pick` 橋接處理器與 `file_picker` 依賴，網頁端選檔一律走 file-manager plugin 的 `pick`。這是破壞性變更：仍呼叫 `picker_pick` 的舊網頁包會因殼沒有該處理器而失敗。file-manager plugin 自己依賴 `file_picker`，桌面與 Android 的選檔能力不變。

## Cross-Repo Scope
- 共用計畫 ID `2611031115-remove-builtin-picker-pick`；各 repo 直接 `main`。
- `aqutter`（本 repo，殼）與 `aqutter-js`（契約型別）名稱成對，同批提交；之後更新 manifest 鎖定點、移動兩個 repo 的 `0.0.0` tag，`aqutter-nuxt-app` 重新對齊。
- 前置計畫：`2611031100-file-picker-into-file-manager`（新增 `pick` 並棄用內建橋接，已歸檔）。

## Key Decisions
- **[範圍]** 殼與 aqutter-js 型別一併移除 — 使用者選擇；使用者 2026-11-03 明確要求「現在就移除」。
- **[文件]** `docs/macos.md`、`docs/linux.md` 的 `file_picker` 說明改指向 file-manager plugin。
- **[對齊]** shell 的 `0.0.0` tag 移到殼的變更提交（與 manifest 記載的 shell ref 相同），不是 manifest 更新提交，否則 `aqutter doctor` 會判定不一致。

## Deviations
- 無契約變更（只刪除既有契約）。
- 驗證：`flutter analyze` 通過；Android 實機（Zenfone 8）重建安裝後，單選 `pick` 仍可用。
- 本機沒有 `.env.prod`，建置改用 `.env.dev`。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart` — 刪 `_registerPicker`、`file_picker` import
- `shell/lib/src/bridge/bridge_names.dart` — 刪 `pickerPick`
- `shell/pubspec.yaml` — 移除 `file_picker`
- `docs/macos.md`、`docs/linux.md` — `file_picker` 說明
- `manifest/releases.json` — shell、client 鎖定點
