<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611031115 - remove-builtin-picker-pick
- Created: 2026-11-03
- Branch: N/A（直接推送 `main`）
- Issue: N/A（本專案開發階段不建 issue）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: 2026-11-03

## Goals
殼移除內建 `picker_pick` 處理器與 `file_picker` 依賴，選檔一律走 file-manager plugin 的 `pick`。

## Architecture
file-manager plugin 的 `pick` 已取代內建 `picker_pick`（計畫 2611031100-file-picker-into-file-manager，已歸檔）；本計畫移除被取代的內建橋接。破壞性變更，使用者 2026-11-03 明確要求「現在就移除」，並選擇一併移除 aqutter-js 的型別。

## Cross-Repo Scope
- 共用計畫 ID: `2611031115-remove-builtin-picker-pick`　共用分支名: 無（直接 `main`）
- `aqutter` — 殼移除 `picker_pick` 處理器、`file_picker` 依賴、文件說明
- `aqutter-js` — 移除 `PickerPick`、`PickerRequest`、`PickerResponse`、`FilePickerMode`、`FilePickerOptions`
- 執行順序：兩邊互不相依（名稱成對，同批提交）；之後更新 `aqutter/manifest/releases.json` 的 shell／client 鎖定點。

## Contract / 介面契約
無（只刪除既有契約，沒有新增介面）。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart` — 刪 `_registerPicker`、`file_picker` import
- `shell/lib/src/bridge/bridge_names.dart` — 刪 `pickerPick`
- `shell/pubspec.yaml`、`shell/pubspec.lock` — 移除 `file_picker`
- `docs/macos.md`、`docs/linux.md` — `file_picker` 說明改指向 file-manager
- `manifest/releases.json` — shell／client 鎖定點

## Open Questions / 待確認事項
無

## Manual Follow-ups / 人工收尾事項
- 無

## Git Completion Policy
- 直接推送 `main`，不開 PR。commit 自動（Rule 17）。

## Key Decisions
- **[範圍]** 殼與 aqutter-js 型別一併移除 — 使用者選擇；`file_picker` 仍由 file-manager plugin 自己依賴，所以桌面／Android 的選檔能力不變。
- **[文件]** `docs/macos.md`、`docs/linux.md` 的 `file_picker` 說明改指向 file-manager plugin。

## References
- 無
