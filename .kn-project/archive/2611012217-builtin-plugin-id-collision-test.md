# 2611012217 - builtin-plugin-id-collision-test

- Created: 2026-11-01 22:17 / Archived: 2026-11-01 22:26
- Issue: Aqutter/aqutter#45
- Milestone: N/A / Base Branch: main

## Summary
補上殼組裝期 plugin id 檢查的測試：App 傳入的 plugin 撞到內建 id、保留 id `aqutter`、id 不合法或兩個 plugin 重複時，`BridgeRegistry.register()` 必須丟 `ArgumentError`；一般的新 id 通過。
檢查本身早已存在，前一份計畫 `2610310119` 歸檔時記為沒有專屬測試。只新增測試，不改正式程式碼，影響 `shell/test/builtin_plugins_test.dart`。

## Cross-Repo Scope
無（單一 repo）。

## Key Decisions
- **[範圍]** 四種情況一起測（內建 id 撞名、保留 id、不合法 id、重複 id）— 同一個函式、同一種測法，邊際成本低。
- **[Q1]** 先試直接建構 `BridgeRegistry`，不行再抽純函式 — 不預先改正式程式碼，使用者選定。
- **[執行中]** 直接建構可行，不抽函式 — 相依都輕量；內建的通知與深層連結服務注入檔內既有假物件，`register()` 才不碰平台通道。
- **[流程]** 完成後 commit + 開 PR。

## Deviations
- 檢查在 `register()` 才執行，不是建構子，測試需呼叫 `register()`；計畫原先只寫「建構」。
- 一般 id 通過的案例需要 `TestWidgetsFlutterBinding.ensureInitialized()`，因為完整的 `register()` 會設定 MethodChannel 與 EventChannel。
- 沒有 wiki 或 README 需要變更（Pruning Report：未發現過時內容）。

## Impact Files
- `shell/test/builtin_plugins_test.dart:38` (`main`) — 新增「plugin id checks at assembly time」group（5 個案例）與 `_IdOnlyPlugin` 輔助類別。
- `shell/lib/src/bridge/bridge_registry.dart:184-196` (`_registerPlugins`) — 被測對象，未修改。
