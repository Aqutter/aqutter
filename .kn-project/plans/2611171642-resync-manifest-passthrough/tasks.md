# Tasks for 2611171642

## Phase 1 — 更新 manifest
- [x] [aqutter] 更新 `releases.json` 的 `generatedAt`、`shell.ref`、`core.ref`、`client.spec`　依賴 Contract §2
- [x] [aqutter] 本機重現 CI：ajv schema、`shell.ref` 等於 `git log -1 --format=%H -- shell`、三個 ref 存在且 pubspec 基準一致

## Phase 2 — 交給 aqutter-cli
- [ ] [aqutter] 需等待 [aqutter-cli]：以本 repo 工作分支的 `releases.json` 同步快照，兩個 PR 各自開出
