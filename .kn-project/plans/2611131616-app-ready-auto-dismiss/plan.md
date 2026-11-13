<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611131616 - app-ready-auto-dismiss
- Created: 2026-11-13
- Branch: feature/2611131616-app-ready-auto-dismiss
- Issue: Aqutter/aqutter#51
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
第一次使用框架的人不知道網頁必須呼叫 `app_ready`，殼的「載入網頁」過場會一直停在 100%（`docs/getting-started.md:68` 有寫，但容易漏看）。讓這個要求預設關閉：沒有用熱更新（OTA）時，殼在頁面載入完成後自動收起過場；有設定 OTA 網址時維持現行嚴格檢查，保留「逾時視為網頁包壞掉並回滾」的保護。

## Architecture
- 新增編譯期鍵 `AQUTTER_REQUIRE_APP_READY`（語意見 Contract）。三態：空＝自動（OTA 網址非空則嚴格）、`true`＝嚴格、`false`＝自動收起。
- `shell/lib/src/app.dart`：
  - 新增判定「本次是否嚴格」的純函式（吃旗標與 OTA 網址，方便單元測試）。
  - `_startReadyWindow`（`:542`）只在嚴格模式啟動逾時判定窗。
  - `_onLoadStop`（`:789`）在非嚴格模式下，等兩個 `requestAnimationFrame` 後由殼端呼叫 `_onWebReady`（`:525`）。dev 模式（`kDevUrl` 非空）同樣適用。
- `shell/lib/src/bridge/bridge_registry.dart:347` 的註解要更新：它說明「刻意不採 onLoadStop」的理由仍成立，改為說明「嚴格模式不採；自動收起模式採 onLoadStop＋兩幀」。
- 文件：`docs/environment.md` 新增一列並修正 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 的說明（只在嚴格模式生效）；`docs/getting-started.md:68` 改為「呼叫是選配，沒用 OTA 時殼會自動收起」；`docs/hot-update.md` 補一句：用 OTA 時要呼叫 `app_ready`；`docs/env.example` 是 aqutter-cli 範本的快照，同步新增該鍵。
- `app_ready` 橋接名稱與 `aqutter-js` 的契約不變，不需改 aqutter-js。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611131616-app-ready-auto-dismiss`　**共用分支名**: `feature/2611131616-app-ready-auto-dismiss`
- **參與 repo 與職責**:
  - `aqutter` — 契約提供方：殼讀取並實作 `AQUTTER_REQUIRE_APP_READY`，更新文件與 env 快照　issue: `Aqutter/aqutter#51`
  - `aqutter-cli` — 契約消費方：`template/env/.env.example` 提供該鍵給新專案　issue: `Aqutter/aqutter-cli#24`
- **執行順序相依**: 契約凍結後，兩邊檔案不相交、可平行；建議合併順序：`aqutter` 先、`aqutter-cli` 後（範本註解會提到殼的行為）。
- **跨 repo 檔案指涉**: `aqutter-cli` 的 `template/env/.env.example`（新增鍵與註解，須與本 repo 的 `docs/env.example` 快照逐字一致）。`aqutter-nuxt-app` 的 `.env/.env.example` 是範例專案，不在本次範圍（見 Manual Follow-ups）。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-13）`

### 1. 端點
無（不涉及 HTTP 端點）。介面是一個編譯期環境變數，由 `aqutter` 的殼讀取，由 `aqutter-cli` 的 env 範本提供給專案。

### 2. 環境變數 `AQUTTER_REQUIRE_APP_READY`
| 項目 | 內容 |
|---|---|
| 型別 | 字串，只接受 `true`、`false` 或空；其他值啟動即報錯（沿用 `BundleUpdateConfig.parseFlag` 的紀律） |
| 預設 | 空（＝自動） |
| 空（自動） | `AQUTTER_UPDATE_BASE_URL` 非空 → 嚴格；`AQUTTER_UPDATE_BASE_URL` 為空 → 自動收起 |
| `true`（嚴格） | 頁面載入完成後必須收到網頁的 `app_ready` 才收起過場；`AQUTTER_WEB_READY_TIMEOUT_SECONDS` 內未收到即視為網頁包壞掉並回滾（現行行為） |
| `false`（自動收起） | 不要求 `app_ready`；即使設了 `AQUTTER_UPDATE_BASE_URL` 也不做逾時回滾 |
| 自動收起的時機 | `onLoadStop` 之後等兩個 `requestAnimationFrame`，由殼端觸發就緒（與收到 `app_ready` 等效） |
| `app_ready` 本身 | 橋接名稱、行為不變；自動收起模式下網頁仍可呼叫，重複呼叫無副作用 |
| 編譯期設定 | 網頁無法更改；`aqutter dev` 注入的 `AQUTTER_DEV_URL` 不影響此鍵的判定 |
| 與 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` | 只在嚴格模式生效；自動收起模式下忽略 |

### 3. 錯誤碼
無新增。`AQUTTER_REQUIRE_APP_READY` 值不合法時啟動拋 `ArgumentError`，訊息格式同其他旗標。

### 4. 狀態與規則
- 判定在啟動時做一次（編譯期常數），執行中不變。
- 嚴格模式與現行行為完全相同，包含逾時回滾與「沒有前一版時落到錯誤畫面」。
- 自動收起模式不啟動就緒判定窗，因此不會觸發 `_handleWebFailure` 的 ready 逾時路徑；載入錯誤、HTTP 錯誤的處理不變。

### 5. 相容性
- 已有的專案若設了 `AQUTTER_UPDATE_BASE_URL`，行為不變（自動 → 嚴格）。
- 沒設 OTA 網址且網頁有呼叫 `app_ready` 的專案：過場可能比以前稍早收起（最早在載入完成後兩個繪製幀），不再等網頁自己呼叫。
- `AQUTTER_REQUIRE_APP_READY` 是新增鍵，舊專案的 env 檔沒有它，等同空值。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `shell/lib/src/app.dart:259-273` (`_readyWindowTimeout`) — 旁邊新增旗標與「是否嚴格」判定
- `shell/lib/src/app.dart:542` (`_startReadyWindow`) — 非嚴格模式不啟動逾時窗
- `shell/lib/src/app.dart:789` (`_onLoadStop`) — 非嚴格模式下兩幀後觸發就緒
- `shell/lib/src/app.dart:525` (`_onWebReady`) — 被自動收起重用，確認可重入
- `shell/lib/src/server/update_config.dart:161` (`BundleUpdateConfig.parseFlag`) — 重用其解析紀律；`:43` 的 `_envBaseUrl` 作為判定來源
- `shell/lib/src/bridge/bridge_registry.dart:347` — 更新註解
- `shell/test/app_ready_mode_test.dart` (new) — 判定函式的單元測試：旗標三態 × OTA 網址有無，非法值報錯
- `docs/environment.md:15` — 新增 `AQUTTER_REQUIRE_APP_READY` 一列，修正 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 說明
- `docs/getting-started.md:68` — 改寫「呼叫 app_ready」一節
- `docs/hot-update.md` — 補一句：啟用 OTA 時必須呼叫 `app_ready`
- `docs/env.example:54` — 快照新增該鍵（與 aqutter-cli 範本一致）
- `.kn-project/wiki/environment.md:18` — Phase 5 wikification 更新（由 env 快照與文件生成）

證據：`docs/getting-started.md:68`（現行要求）、`app.dart:547`（逾時回滾）、`bridge_registry.dart:347`（不採 onLoadStop 的理由）、`aqutter/AGENTS.md` 紅線 3（env 鍵三處成對）；實測：`C:\aqt\web` 的建置版因頁面沒呼叫 `app_ready` 而卡在「載入網頁 100%」。

## Open Questions / 待確認事項
> 本計畫的設計取捨（收起時機、OTA 互動）與 milestone 已於對話中確認，見 Key Decisions。
### Q1. 兩個幀之後仍可能露出 hydration 未完成的畫面 — 影響範圍：`app.dart`
- 這是已接受的取捨（使用者選了「載入完＋兩幀」）；需要完全無空白的專案請設 `AQUTTER_REQUIRE_APP_READY=true` 並呼叫 `app_ready`。
- **決議**：已接受　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 移動 `aqutter` 與 `aqutter-cli` 的 `0.0.0` tag 到各自合併後的 main — 對我說「移動 tag」 — 移動遠端 tag 屬對外覆寫，由你下令才做
- **[合併後]** 以沒設 OTA 網址、頁面不呼叫 `app_ready` 的專案實跑 Windows app，確認過場自動收起並進到網頁 — 例如 `C:\aqt\web` 的測試頁（只有 `<h1>`）搭配 `aqutter dev windows` — 需要實機視窗，且要等兩個 repo 的 tag 都移動後才在乾淨安裝下成立
- **[合併後]** `aqutter-nuxt-app` 的 `.env/.env.example` 是否同步新增該鍵 — 對我說「同步 nuxt-app」 — 它是獨立的範例專案 repo，另開計畫

## Key Decisions
- **[Milestone]** 不指定，base 為 `main` — 理由：開發階段版本一律 `0.0.0`；來源：Phase 0 詢問（本 repo 一題）
- **[設計]** 預設自動收起，旗標 `AQUTTER_REQUIRE_APP_READY` 三態；有 OTA 網址則自動嚴格 — 理由：嚴格檢查的保護只對 OTA 的回滾有意義，沒用 OTA 的新手最容易被卡住；來源：使用者選「有設 OTA 網址就嚴格」
- **[設計]** 自動收起時機為 `onLoadStop` 後兩個 `requestAnimationFrame` — 理由：避開多數空白畫面，比單純 onLoadStop 穩；來源：使用者選「載入完＋兩個繪製幀」
- **[範圍]** `aqutter-nuxt-app` 不納入 — 理由：獨立範例專案，另開計畫
- **[契約]** rev 1 凍結（核准日 2026-11-13）
- **[完成後]** commit + 開 PR（預設）；歷史改寫（rebase、force-with-lease）將於核准時揭露

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base (Rule 23)。
- 每個 commit 訊息與 PR body 都含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`）。歸檔後於該 issue 張貼結案留言 (Rule 20)。
- Issue 的關閉發生在合併後清理 (Rule 21)。
- commit 一律自動（Rule 17）；完成時 `git fetch` 後 `git rebase origin/main` 並 `git push --force-with-lease --force-if-includes`。
- PR/archive order: Archive automatically triggered on PR request
- 跨 repo 時，本 repo 自己開自己的 PR (Rule 19)。

## References
- `docs/getting-started.md:68`、`shell/lib/src/app.dart:259-273,542,789`、`shell/lib/src/bridge/bridge_registry.dart:347`
- `C:\aqt\web` 實測：頁面未呼叫 `app_ready`，過場卡在「載入網頁 100%」
