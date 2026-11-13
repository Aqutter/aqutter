# 2611131616 - app-ready-auto-dismiss

- Created: 2026-11-13 16:16 / Archived: 2026-11-13 16:55
- Issue: Aqutter/aqutter#51
- Milestone: N/A / Base Branch: main

## Summary
殼的啟動過場原本一定要等網頁呼叫 `app_ready` 才收起，第一次使用框架的人沒呼叫就會卡在「載入網頁」。新增編譯期鍵 `AQUTTER_REQUIRE_APP_READY`（三態）：預設（空）時，沒設 `AQUTTER_UPDATE_BASE_URL` 就由殼在 `onLoadStop` 後等兩個繪製幀自行宣告就緒；有設熱更新網址則維持嚴格（必須呼叫、逾時回滾）；`true` 強制嚴格、`false` 一律自動收起。
實機驗證：本機殼＋沒呼叫 `app_ready` 的頁面（`aqutter dev windows`）過場自動收起並顯示頁面。

## Cross-Repo Scope
與 Aqutter/aqutter-cli#24 共用 ID 與分支名；本 repo 是契約正本（Contract rev 1，無端點、無錯誤碼，只有一個編譯期鍵），aqutter-cli 提供 env 範本。

## Key Decisions
- **[Milestone]** 不指定，PR 併回 main — 理由：開發階段版本一律 0.0.0。
- **[設計]** 預設自動收起；有 OTA 網址則自動嚴格 — 理由：嚴格檢查的保護只對 OTA 回滾有意義，沒用 OTA 的新手最容易被卡住。
- **[設計]** 自動收起時機為 `onLoadStop` 後兩個 `requestAnimationFrame`，並設 2 秒上限、腳本不支援時照樣收起 — 理由：避開多數空白畫面；視窗在背景時 rAF 會暫停，不設上限過場永遠不收。
- **[範圍]** `aqutter-nuxt-app` 不納入 — 理由：獨立範例專案，另開計畫。
- **[契約]** rev 1 凍結（核准日 2026-11-13），執行中未變更。

## Deviations
- 未驗證：嚴格模式（`true` 與有 OTA 網址）的實機行為，只有單元測試覆蓋判定邏輯，嚴格路徑的程式碼沒改動；非 Windows 平台未實測，`callAsyncJavaScript` 不支援時會直接收起；單頁應用 hydration 較慢時可能短暫露出未完成畫面（已接受的取捨）。

## Impact Files
- `shell/lib/src/app_ready_mode.dart` (new) — `requiresAppReady` 判定與兩幀腳本
- `shell/lib/src/app.dart:50,265,349,558,808` — 讀取旗標、嚴格模式才起算逾時窗、非嚴格模式兩幀後 `_onWebReady`
- `shell/lib/src/bridge/bridge_registry.dart:347` — 更新註解
- `shell/test/app_ready_mode_test.dart` (new) — 判定函式與腳本的單元測試（完整測試 270 個通過）
- `docs/environment.md:15`、`docs/getting-started.md:68`、`docs/hot-update.md`、`docs/env.example:54` — 文件與 env 快照
- `.kn-project/wiki/environment.md` — 由 env 快照重新生成

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
