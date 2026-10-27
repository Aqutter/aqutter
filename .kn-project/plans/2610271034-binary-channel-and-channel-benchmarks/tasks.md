# Tasks for 2610271034

## Phase 1 — Windows 調查（可獨立先做）
- [x] 把基準工具放進 `tools/channel-bench/`，確認可重現 Windows 下行偏慢
- [x] 隔離：`dart:io` 伺服器／WebView2／TCP 設定（含用一般瀏覽器連同一個伺服器作對照）
- [x] 驗證「Windows 鏡像上限是 WebSocket 下行」的假設
- [x] 結論與（可行時的）修正；不可行則記錄與 workaround

## Phase 2 — 通道（需 aqutter_core 新版）
- [ ] `AqutterPlugin.channels`（型別用 core 的 `AqutterChannelHandler`）與匯出
- [ ] `_registerPlugins` 註冊／取消註冊，與 `supportedPlatforms` 整合
- [ ] `plugin_test.dart`

## Phase 3 — 文件與量測
- [ ] `docs/plugins.md`、`docs/channel-performance.md`、`docs/windows.md`、`project.md`
- [ ] 以通用通道重量一次（對照 JSON／base64 的數字）
- [ ] `flutter analyze`、`flutter test`、wiki lint／build
