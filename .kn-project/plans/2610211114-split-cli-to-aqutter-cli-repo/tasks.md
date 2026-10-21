# Tasks for 2610211114

> 本檔只列 `Aqutter/aqutter` 的工作項；`aqutter-cli` 與下游範本專案的工作以「需等待」引用，不在此列項。Open Questions 全部確認前不得開始 Phase 1。

## Phase 1 — 契約定案與 manifest 骨架
- [ ] [aqutter] 建立 `manifest/schema.json`（new）：依 Contract §2、§4 的欄位、型別、必填與格式（sha 為 40 位十六進位、版本為 `X.Y.Z`、URL 主機允許清單）
- [ ] [aqutter] 建立 `manifest/releases.json`（new）：只放 `0.0.0` 一筆，`flutter.baseline` 為 `3.47.4`、`shell.ref`／`core.ref` 依 Q4 填目前 `main` 的 commit sha 或 tag、`channels.stable` 指向 `0.0.0`
- [ ] [aqutter] 契約凍結：核准即凍結 rev 1，狀態改為 `凍結`（Rule 28）

## Phase 2 — CI 與 manifest 發佈
- [ ] [aqutter] 建立 `.github/workflows/manifest-check.yml`（new）：驗 schema、各 ref 在遠端存在、`flutter.baseline` 與 `shell/pubspec.yaml`、`aqutter_core` 的 Flutter 下限一致、`channels.stable` 指向 `supported`
- [ ] [aqutter] 合併後以 raw 網址實際取得 `manifest/releases.json` 並確認可被解析

## Phase 3 — 文件與治理檔（先寫成「新安裝語法即將生效」，移除 `cli/` 後再最終定稿）
- [ ] [aqutter] 更新 `README.md:20-21`、`docs/getting-started.md:16-17`、`client/README.md:14` 的安裝說明，列出四種套件管理器的現況　需等待 [aqutter-cli]：新 repo 的安裝網址確定
- [ ] [aqutter] 改寫 `docs/cli.md:94`（`aqutter doctor`）、`docs/cli.md:113`（`aqutter upgrade`），補 manifest、`--offline`、`AQUTTER_MANIFEST_URL`
- [ ] [aqutter] 建立 `docs/releases.md`（new）：manifest 欄位、各 release 的升級說明
- [ ] [aqutter] 改寫 `AGENTS.md:10-13` 紅線 3、4、4.1、5，並更新 `AGENTS.md:7` 與 `AGENTS.md:15-20`（移除 `cd cli …`）
- [ ] [aqutter] 更新 `.kn-project/project.md:12`、`:20`、`:22`
- [ ] [aqutter] 更新 wiki：`ops/distribution.md`、`platform/architecture.md`

## Phase 4 — 驗證
- [ ] [aqutter] 本機驗證 manifest 通過 `manifest/schema.json`，各 ref 存在
- [ ] [aqutter] `wiki-lint` 硬閘 0 項，重建 `wiki.html`
- [ ] [aqutter] 檢查 README 與 docs 內所有相對連結可達
- [ ] [aqutter] 產出交接清單給 `aqutter-cli` 的計畫（Contract §5 的改變、現有程式碼的 `path:line`、範本與 manifest 的一致性檢查、env 鍵對照、`subtree split` 保留歷史的指令）　需等待 [aqutter-cli]：新 repo 建立並完成治理初始化

## Phase 5 — 移除 `cli/`（最後執行，不可回復）
- [ ] [aqutter] 確認閘門全部成立：`aqutter-cli` 已建立並保留完整歷史　需等待 [aqutter-cli]：已發佈可安裝的版本
- [ ] [aqutter] 確認閘門：npm、yarn、pnpm 可用新語法安裝並跑通 `aqutter --version`（bun 見 Manual Follow-ups）　需等待 [aqutter-cli]：同上
- [ ] [aqutter] 確認閘門：下游範本專案已改用新語法　需等待 [aqutter-nuxt-app]：其計畫完成
- [ ] [aqutter] `git rm -r cli/`，並確認 `README.md`、`docs/`、`AGENTS.md`、`.kn-project/project.md` 內不再有指向 `cli/` 的連結或指令
