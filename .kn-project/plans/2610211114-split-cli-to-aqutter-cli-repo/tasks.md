# Tasks for 2610211114

> 本檔只列 `Aqutter/aqutter` 的工作項；`aqutter-cli` 與下游範本專案的工作以「需等待」引用，不在此列項。範圍已縮小為第一階段（見 plan.md 的 [範圍調整]）。

## Phase 1 — 契約定案與 manifest 骨架
- [x] [aqutter] 建立 `manifest/schema.json`（new）：依 Contract §2、§4 的欄位、型別、必填與格式（sha 為 40 位十六進位、版本為 `X.Y.Z`、URL 主機允許清單）
- [x] [aqutter] 建立 `manifest/releases.json`（new）：只放 `0.0.0` 一筆，`flutter.baseline` 為 `3.47.4`、`shell.ref`／`core.ref` 依 Q4 填 commit sha、`channels.stable` 指向 `0.0.0`
- [x] [aqutter] 契約凍結：核准即凍結 rev 1，狀態改為 `凍結`（Rule 28）

## Phase 2 — CI 與說明
- [x] [aqutter] 建立 `.github/workflows/manifest-check.yml`（new）：驗 schema、各 ref 在遠端存在、`flutter.baseline` 與 `shell/pubspec.yaml`、`aqutter_core` 的 Flutter 下限一致、`channels.stable` 指向 `supported`
- [x] [aqutter] 建立 `docs/releases.md`（new）：manifest 欄位與更新方式

## Phase 3 — 驗證與 wiki
- [x] [aqutter] 本機驗證 manifest 通過 `manifest/schema.json`，各 ref 存在
- [x] [aqutter] 產出交接給 `aqutter-cli` 的計畫（Contract §5、現有程式碼的 `path:line`）：已隨 `aqutter-cli` 的 plan.md 完成
- [x] [aqutter] wiki：新增 `ops/release-manifest.md`、更新 `ops/distribution.md` 與 `index.md`，`wiki-lint` 硬閘 0 項，重建 `wiki.html`
- [x] [aqutter] 檢查 `docs/releases.md` 內相對連結可達

## 移到後續計畫（不在本計畫範圍；等 `aqutter-cli` 可安裝後另開新計畫）
- 更新 `README.md:20-21`、`docs/getting-started.md:16-17`、`client/README.md:14` 的安裝說明，列出四種套件管理器的現況
- 改寫 `docs/cli.md:94`（`aqutter doctor`）、`docs/cli.md:113`（`aqutter upgrade`），補 manifest、`--offline`、`AQUTTER_MANIFEST_URL`
- 改寫 `AGENTS.md:10-13` 紅線 3、4、4.1、5，並更新 `AGENTS.md:7` 與 `AGENTS.md:15-20`（移除 `cd cli …`）
- 更新 `.kn-project/project.md:12`、`:20`、`:22`
- 更新 wiki 中描述安裝語法與組成的頁面（`ops/distribution.md`、`platform/architecture.md`）
- 最後移除舊 `cli/`（不可回復）。閘門：`aqutter-cli` 已發佈可安裝、npm／yarn／pnpm 可用新語法安裝並跑通 `aqutter --version`（bun 需人工驗證）、下游範本專案已改用新語法
