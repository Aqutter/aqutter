<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611190044 - sync-after-native-touch
- Created: 2026-11-19
- Branch: feature/2611190044-sync-after-native-touch
- Issue: Aqutter/aqutter#80
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
把 `manifest/releases.json` 同步到 iOS 原生觸控（`aqutter_core` #40、`aqutter-js` #21、`aqutter-plugins` #13、`aqutter` #79）合併後的主幹，並把 `docs/nativeview.md` 的穿透說明更新為目前行為（iOS 觸控直接進原生、`webRegions`、plugin 要做的事）。這是前一份計畫 `2611172358-ios-passthrough-drag-jitter` 留下的人工收尾事項。

## Architecture
- manifest：`shell.ref` → `e39621f…`（該 commit 改了 `shell/`，CI 要求 `shell.ref` 等於 `git log -1 -- shell`）、`core.ref` → `671bef9…`、`client.spec` → `#a4ad506…`、`generatedAt` 更新。
- 文件：`docs/nativeview.md` 修剪過時說法並新增「iOS 的原生觸控」；`wiki` 若有相關列一併檢查。
- 實作遵守 `kn-project-code-style`。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`（契約正本）
- **參與 repo 與職責**: `aqutter`（manifest 與文件）、`aqutter-cli`（同步內建快照並重打包 `dist/`）、`aqutter-nuxt-app`（鎖定前進，不開 PR）。上游 `aqutter_core`、`aqutter-js` 只移動 `0.0.0` tag，不改程式碼。
- **共用計畫 ID**: `2611190044-sync-after-native-touch`　**共用分支名**: `feature/2611190044-sync-after-native-touch`（`aqutter-nuxt-app` 不開分支，見其計畫）
- **執行順序相依**: 上游 tag 先移動（`aqutter_core`、`aqutter-js` 的 `0.0.0` → 各自 main）→ `aqutter`（manifest、文件）合併 → `aqutter` 的 `0.0.0` tag 移動 → `aqutter-cli` 快照合併 → `aqutter-cli` 的 `0.0.0` tag 移動 → `aqutter-nuxt-app` 鎖定前進。
- **合併後的連動**: 合併後移動 `aqutter` 的 `0.0.0` tag 到合併 commit。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`（`manifest/releases.json`，schema 1）　**修訂號**: `rev 1`　**狀態**: `草擬`
- 沒有 HTTP 端點。介面是 manifest 檔本身：`aqutter-cli` 的 `src/manifestSnapshot.json` 必須與 `aqutter/manifest/releases.json` 逐字相同（由 `pnpm manifest:sync` 產生）。
- 欄位與限制：`shell.ref` 必須等於 `git log -1 -- shell` 的 commit（CI manifest-check 檢查）；`core.ref`、`client.spec` 的 commit 必須存在於各自 repo；`flutter.baseline`、`dart` 不變；`generatedAt` 為更新時間（UTC，ISO 8601）。
- 本次新值：`shell.ref` = `e39621f6692c8b56e1102618ddebd6f5379dbfba`、`core.ref` = `671bef98208069983843c2f9517b8e3098b9b4cc`、`client.spec` = `github:Aqutter/aqutter-js#a4ad50629db4ae1eaa42f6c5862ae827d2919477`。
- 相容性：只改三個 ref 與 `generatedAt`，不改 schema 與其他欄位。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `manifest/releases.json:3`（`generatedAt`）、`:15`（`shell.ref`）、`:20`（`core.ref`）、`:23`（`client.spec`）— 三個 ref 與時間
- `docs/nativeview.md:82`（PlatformView 在 iOS 的說明）、`:94`（`auto` 的平台說明）— 更新並新增 iOS 原生觸控一節
- `.kn-project/archive/2611190044-sync-after-native-touch.md` (new) — 歸檔

## App-Flow Screens
（無 `.kn-project/app-flow.json`，不適用。）

## Open Questions / 待確認事項
無。

## Manual Follow-ups / 人工收尾事項
無（本計畫就是在做前一份計畫的收尾事項）。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`、`aqutter-nuxt-app`；使用者回覆「都做」。
- **[Milestone]** 不指定，base `main`。
- **[tag]** `0.0.0` 是浮動 tag（殼與 plugin 以它為 ref，過去每次同步後都移動）；使用者明確要求移動。移動前記下舊值：`aqutter_core` `84d9174…`、`aqutter-js` `3f250d6…`、`aqutter` `bab2f0b…`、`aqutter-cli` `2710dce…`。
- **[完成後]** commit + 開 PR（`aqutter`、`aqutter-cli`）；`aqutter-nuxt-app` 依其 `project.md` 直接推 main。

## Git Completion Policy
- PR 一律以 `--base main`；每個 commit 與 PR body 含 `Closes #<issue>`；歸檔後在 issue 張貼結案留言。

## References
- `.kn-project/archive/2611181800-resync-manifest-auto-hole.md`（前一次同樣流程）
