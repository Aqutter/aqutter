# 2610211529-move-client-to-aqutter-js

- Created: 2026-10-21 15:29 / Archived: 2026-10-21 16:30
- Issue: Aqutter/aqutter#7
- Milestone: N/A / Base Branch: main

## Summary
把 client 搬到獨立 repo `Aqutter/aqutter-js`（初始 commit `ac7c23b`，tag `0.0.0`），npm、pnpm、yarn 皆可用 `github:Aqutter/aqutter-js#<ref>` 安裝；manifest 的 `client.spec` 改到新位置，`manifest-check` 改檢查新格式，文件／治理檔／wiki 改寫，並移除 `client/`。開發階段破壞式移動，不留舊語法相容層。

契約 rev 1（正本 `Aqutter/aqutter`，核准日 2026-10-21）：安裝字串為 `github:Aqutter/aqutter-js#<ref>`；manifest `client.spec` 的值改格式、結構不變；舊格式不再支援。PR：https://github.com/Aqutter/aqutter/pull/8

## Cross-Repo Scope
- **共用計畫 ID**: `2610211529-move-client-to-aqutter-js`　**共用分支名**: `feature/2610211529-move-client-to-aqutter-js`
- **參與 repo 與職責**（一 repo 一 issue，尚未建立者寫 `待建立`）:
  - `Aqutter/aqutter`（契約正本；本計畫）— manifest `client.spec` 改新位置、`manifest-check` 改檢查、文件與治理檔改寫、最後移除 `client/`。issue: 待建立
  - `Aqutter/aqutter-js`（新 repo）— 承接 `client/` 內容與 tag `0.0.0`；建立後另有自己的計畫與 issue。issue: 待建立
  - `Aqutter/aqutter-cli`（消費方）— 辨識新格式、`upgrade` 改寫、`plugin create` 與範本、內建 manifest 快照。issue: 待建立
  - `Aqutter/aqutter-nuxt-app`（下游）— `package.json` 的 client 依賴與 lock。issue: 待建立
  - `Aqutter/aqutter-plugin-battery`、`aqutter-plugin-haptics`、`aqutter-plugin-mirror-demo`、`aqutter-plugin-google-maps`（下游，各自一份計畫）— `package.json` 的 client 依賴與 lock。issue: 待建立
- **執行順序相依**: ① 建立 `aqutter-js` 並匯入內容、打 tag → ② `aqutter`（取得 aqutter-js 的 sha 後改 manifest、文件，並移除 `client/`）合併 → ③ `aqutter-cli`（從合併後的 manifest 同步快照）→ ④ `aqutter-nuxt-app` 與四個 plugin（用新 CLI 的 `upgrade` 或手改依賴，重產 lock）。契約提供方先、消費方後。
- **範圍外**: 不改 npm 套件名；不新增 npm 發佈；bun 驗證；跨 repo CI 比對。

- **本計畫所屬 repo**: `Aqutter/aqutter`

## Key Decisions
- **[Phase 0]** 目標 repo 清單見 Cross-Repo Scope；整合主幹 `main`；milestone 不指定，base 為 `main`（逐 repo 詢問，皆選不指定）。
- **[路線]** client 拆成獨立 repo `Aqutter/aqutter-js`（使用者選擇，取代「發佈 npm」與「CI 鏡像分支」）— 理由：不需 npm 帳號與憑證，四種套件管理器都能以根目錄安裝，同 `aqutter-cli` 流程。
- **[命名]** repo 名 `aqutter-js`（連字號，對齊 `aqutter-cli`）；npm 套件名 `@aqutter/aqutter` 不改 — 理由：已寫入紅線 1、範本、manifest，改名是破壞性變更，等確定發佈 npm 時再議。
- **[歷史]** aqutter-js 不保留 `client/` 的 git 歷史，全新起點 — 來源：使用者選擇。
- **[manifest]** 原地修改 release `0.0.0` 的 `client.spec`，不新增版本 — 來源：使用者選擇；已知例外於 `docs/releases.md`「已發佈版本不改欄位」規則，開發階段 `0.0.0` 本就隨 `main` 移動。
- **[破壞式移動]** 開發階段不考慮既有程式、不留過渡相容層，改完同步修改 `aqutter-nuxt-app` 與四個 plugin repo — 來源：使用者指示（2026-10-21）。
- **[契約]** rev 1 凍結（核准日 2026-10-21）。
- **[完成後]** commit + 開 PR（併回 `main`）。
- **[執行模式]** 序列（相依鏈是一條線）；**[完成後]** 待核准閘決定。
- **[client/ 處理]** 直接移除，放最後一步 — 來源：使用者「破壞式移動」指示；沿用先前移除 `cli/` 的作法。

## Deviations
- aqutter-js 已建立（`Aqutter/aqutter-js`，初始 commit `ac7c23b`，tag `0.0.0`），npm／yarn／pnpm 皆已用該 sha 實測可安裝。
- 移除 `client/` 與其他修改在同一個 PR，而非「下游遷移完成後」：下游（CLI、範本專案、plugin）必須先有合併後的 manifest 才能遷移，破壞式移動不留相容層（使用者指示）。

## Impact Files
- `manifest/releases.json:24`（`releases.0.0.0.client.spec`）— 改為 `github:Aqutter/aqutter-js#<sha>`（需先有 aqutter-js 的初始 commit）。
- `.github/workflows/manifest-check.yml:123-132` — 步驟 4 的正規式與 `repos/Aqutter/aqutter/commits/` 改為驗證新格式與 `Aqutter/aqutter-js` 上的 commit；`client.spec` 不符新格式時回報錯誤。
- `manifest/schema.json:87`（`client`）— 檢視 `spec` 描述是否需補新格式（結構不動）。
- `docs/releases.md:34,52` — `client` 欄位說明與「新增或更新版本」步驟的對象。
- `README.md:10,23` — 組成表的 `client/` 列改為指向 aqutter-js；快速開始的 client 安裝改 `npm i github:Aqutter/aqutter-js#0.0.0` 等。
- `docs/getting-started.md:24-30` — client 安裝說明改為四種之外的三種（npm、pnpm、yarn；bun 未驗證），移除「只有 pnpm」的限制說明。
- `docs/cli.md:128` — `upgrade` 對 client 依賴的描述改為新格式。
- `AGENTS.md:8,9` — 紅線 2、2.1 的 `client/src/...` 路徑改為 `Aqutter/aqutter-js` 的對應路徑並標明跨 repo；`AGENTS.md:10` 一併提醒 client 在 aqutter-js。
- `.kn-project/project.md:11,21,24` — 目錄表移除 `client/`；發佈與安裝說明；Native view 鏡像的 `client/src/nativeview/...` 路徑。
- `shell/lib/src/bridge/bridge_names.dart:1` — 註解的 `client/src/contract/bridge.ts` 改為 `Aqutter/aqutter-js` 的路徑。
- wiki：`ops/distribution.md`、`platform/architecture.md`、`dev/verification.md`（移除 `cd client …` 驗證段）；`client/` 移除前先確認 `docs/*.md` 無其他連結（`grep "client/"` 目前只有上列檔案）。
- `client/`（整個目錄，`git rm -r`）— 最後一步，不可回復；閘門：aqutter-js 已含相同內容並打 tag、`aqutter-cli`、`aqutter-nuxt-app`、四個 plugin 已遷移。

## Details
- 驗證與未驗證項目見 PR：https://github.com/Aqutter/aqutter/pull/8
- 整批工作的合併順序：`Aqutter/aqutter`（#8）→ `Aqutter/aqutter-cli`（#5）→ 範本專案與四個 plugin。

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `dev/verification.md` | 2026-10-21 | — | client 拆到 aqutter-js 後的說明改寫 | [#7](https://github.com/Aqutter/aqutter/issues/7) | [PR #8](https://github.com/Aqutter/aqutter/pull/8) |
| `ops/distribution.md` | 2026-10-21 | — | client 拆到 aqutter-js 後的說明改寫 | [#7](https://github.com/Aqutter/aqutter/issues/7) | [PR #8](https://github.com/Aqutter/aqutter/pull/8) |
| `platform/architecture.md` | 2026-10-21 | — | client 拆到 aqutter-js 後的說明改寫 | [#7](https://github.com/Aqutter/aqutter/issues/7) | [PR #8](https://github.com/Aqutter/aqutter/pull/8) |
