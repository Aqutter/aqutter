# 2610220907-dev-startup-race

- Created: 2026-10-22 09:07 / Archived: 2026-10-22 10:00
- Issue: Aqutter/aqutter#9
- Milestone: N/A / Base Branch: main

## Summary
殼在 dev 模式（有 `AQUTTER_DEV_URL`）遇到主文件的載入錯誤或 HTTP 錯誤時，改為每秒重試一次、最多 60 次並維持啟動畫面，而不是立刻顯示「啟動失敗」；`app_ready` 收到後歸零。release 與 OTA 的失敗處理不動。同時更新 `docs/cli.md` 的 `aqutter dev` 說明。

## Cross-Repo Scope
- `Aqutter/aqutter`（殼）— dev 模式載入 dev server 失敗時重試，issue `Aqutter/aqutter#9`。
- `Aqutter/aqutter-cli`（`aqutter dev`）— 等網頁 dev server 就緒再啟動 `flutter run`，issue `Aqutter/aqutter-cli#6`。
- 兩層互相補強：CLI 擋啟動時的競爭，殼擋執行中 dev server 重啟。契約：無（行為變更，不影響 manifest 結構）。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；milestone 不指定。完成後：commit + 開 PR。
- **[修法]** 兩層一起做（使用者選擇，建議是只做 CLI 這層）。
- **[CLI]** 探測 `http://localhost:<port>/` 與 `http://127.0.0.1:<port>/`，任一回應非 5xx 視為就緒；逾時 180 秒；每 5 秒印等待訊息。
- **[殼]** 只在 dev 模式（有 `AQUTTER_DEV_URL`）重試，每秒一次最多 60 次；release 與 OTA 的失敗處理與回滾不動。

## Details
- 驗證：`flutter analyze` No issues found、`flutter test` 86 個全過。
- 未驗證：重試路徑本身沒有實測（單元／widget 測試沒有涵蓋，需要模擬 dev server 失敗再恢復）；App 端只驗證了 CLI 這一層讓啟動不再撞 503。
- 注意：這個改動在 `shell/`，`aqutter-nuxt-app` 以 tag `0.0.0` 取用，要把 tag 移到新 commit、並更新 `manifest/releases.json` 的 `shell.ref`（sha）才會生效，這兩件事不在本 PR。
