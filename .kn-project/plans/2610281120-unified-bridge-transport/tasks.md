# Tasks for 2610281120

## Phase 1 — 契約（需等待：使用者核准並凍結契約）
- [ ] 凍結契約 rev 1，三個 repo 的 `## Contract` 逐字相同

## Phase 2 — 殼端傳輸（依賴 Contract §2、§3）
- [x] 需等待 aqutter_core：`AqutterRpcHost` 合併並移動 tag
- [x] `bridge_registry.dart`、`bridge_emitter.dart`、`app.dart`：內建 handler 與 plugin handler 改登錄到 `AqutterRpcHost`，`supportedPlatforms` 與 `aqutterError` 界接，事件改走 `emit`
- [x] 移除 `AqutterPlugin.channels` 與輔助函式、保留 id `aqutter`、更新匯出與測試

## Phase 3 — 驗證與文件（需等待 aqutter-js：傳輸完成）
- [x] Android 實機端對端：呼叫、事件、二進位往返、重連（殼 `restart()`）、CSP 擋掉的錯誤；與舊數字對照
- [ ] Windows 實機端對端與量測
- [ ] Linux（WSL2 Debian 13）端對端驗證
- [x] `docs/plugins.md`、`docs/channel-performance.md`、`docs/getting-started.md`、`tools/channel-bench`、wiki、project.md
- [ ] `flutter analyze`、`flutter test`、wiki lint／build
