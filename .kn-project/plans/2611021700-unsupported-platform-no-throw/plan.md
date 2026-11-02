# Plan: 2611021700 - unsupported-platform-no-throw
- Created: 2026-11-02
- Branch: N/A（直接 main）
- Issue: N/A（無 issue 追蹤基準）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
殼配合新契約：回報 `platform_info.dev`、debug 建置時對不支援的呼叫印日誌，並更新文件。傳輸語意（`UNSUPPORTED_PLATFORM`）不變。

## Architecture
契約與完整設計見 `aqutter-js` 的同名計畫（契約正本）：不支援的平台呼叫 plugin 回 `undefined`、型別為 `Res | undefined`、只在開發階段警告。本 repo 依該契約實作自己的部分。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`
- **共用計畫 ID**: `2611021700-unsupported-platform-no-throw`；各 repo 直接 `main`。
- **參與 repo**: `aqutter-js`（契約正本）、`aqutter`、`aqutter-plugins`、`aqutter-nuxt-app`。
- **執行順序相依**: `aqutter-js` 先 push；其餘依賴新型別，等它之後。

## Contract / 介面契約
見 `aqutter-js` 的同名計畫 `## Contract / 介面契約`（逐字相同的區塊不在此重複，避免兩份漂移；以契約正本為準）。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart:337`（`_platformInfo`）— 新增 `dev`
- `shell/lib/src/bridge/bridge_registry.dart:204`（不支援方法的 handler）— debug 建置時印日誌
- `shell/lib/src/app.dart:343`（建立 `BridgeRegistry` 處）— 傳入 dev 狀態
- `shell/test/`（new 或既有的 bridge 測試）— `dev` 與日誌
- `docs/plugins.md`、`.kn-project/wiki/platform/plugin-registration.md` — 呼叫不支援方法的行為
- `manifest/releases.json` — client 版本跟版（aqutter-js push 之後）

## Open Questions / 待確認事項
同 `aqutter-js` 的同名計畫（Q1 沒裝 plugin、Q2 純瀏覽器、Q3 警告出口）；本 repo 不另有待確認事項。

## Manual Follow-ups / 人工收尾事項
無

## Key Decisions
- 見 `aqutter-js` 的同名計畫。

## Git Completion Policy
- commit 自動；push 依核准閘選項。
