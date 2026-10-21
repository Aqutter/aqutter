# Tasks for 2610211529-move-client-to-aqutter-js

## Phase 1 — 契約提供方：建立 aqutter-js
- [x] 建立 `Aqutter/aqutter-js`（公開）並匯入 `client/` 內容為第一個 commit、打 tag `0.0.0`（建立 repo 需先取得核准）
- [x] 在 aqutter-js 內跑 `pnpm install && pnpm typecheck && pnpm test` 確認內容可獨立運作
- [ ] 為 aqutter-js 初始化治理結構與其計畫（另開，逐 repo 詢問）

## Phase 2 — 本 repo
- [x] `manifest/releases.json` 的 `client.spec` 改為 `github:Aqutter/aqutter-js#<sha>`
- [x] `manifest-check.yml` 步驟 4 與 `manifest/schema.json` 描述
- [x] README、getting-started、cli.md、releases.md、AGENTS.md、project.md、`bridge_names.dart:1` 註解
- [x] wiki 更新、lint、build
- [x] 驗證：manifest 以 ajv-cli 驗證；`manifest-check` 的檢查邏輯在本機對真實 repo 跑過，並以故意改壞的 client.spec 確認會失敗

## Phase 3 — 下游遷移完成後
- [ ] 確認 aqutter-cli、aqutter-nuxt-app、四個 plugin 已遷移並驗證
- [x] `git rm -r client/`，全 repo grep 確認無殘留參照
