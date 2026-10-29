# 2610291408-console-file-logging

- Created: 2026-10-29 14:08 / Archived: 2026-10-29 16:30
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼的 log_append 支援選填 target（provider／dir／name）：依 provider 取根目錄、嚴格驗證子目錄與檔名、追加寫入 `{根}/{dir}/{name}_{yyyyMMdd}.log`；缺省 target 行為不變。
LogService 可注入時鐘並補跨午夜換檔測試；manifest 的 client.spec 指向含 console 擴充的 aqutter-js。

## Cross-Repo Scope
- 共用計畫 ID：`2610291408-console-file-logging`；直接 main，無分支。
- 參與 repo：aqutter-js（契約、installConsoleLog、console.to）、aqutter（殼 LogService.append 支援 target 與驗證）、aqutter-nuxt-app（範例接線）。
- 執行順序：aqutter-js → aqutter（再更新 manifest 的 client.spec）→ aqutter-nuxt-app（aqutter upgrade 後接線）。本 repo：aqutter。

## Key Decisions
- **範圍**：能力在 aqutter-js、nuxt-app 僅範例 — 使用者明示。
- **Provider**：internal（預設）／documents／cache／temp／external（僅 Android）— 對應 path_provider 既有 API，不需額外權限。
- **安全**：dir／name 只允許相對安全字元、禁止 `..` 與絕對路徑，provider 不可用時報錯不改寫 — 避免 JS 任意寫檔；Dart 端為最後防線。
- **v1 範圍**：不攔 window.onerror，list／read／remove 不涵蓋自訂 target — 控制範圍（後續由 2610291528 補上 JS 錯誤捕捉）。
- **release**：SDK 不判斷環境，devtools 由 App 傳入 — SDK 框架中立，Nuxt 用 import.meta.dev。
- **流程**：直接 main、不建 issue；完成後只 commit（後續依使用者要求 push 並移動 tag 0.0.0）。
- **契約**：rev 1 凍結；rev 2 新增 TargetSource（target 可為函式，每筆呼叫當下求值）、setConsoleLogTarget、log_target_error（丟例外改走預設位置並提示一次）。
- **Iteration／換日驗證**：LogService 加可注入時鐘（預設行為不變）並補跨午夜測試；JS 補假時鐘測試；實機以每分鐘換檔名的函式 target 驗證。
- **useAppLog**：console 已被攔截時不再走 bridge 寫檔，避免同一行寫兩次。
- **執行模式**：序列（aqutter-js → aqutter → aqutter-nuxt-app）。

## Deviations
- 殼的 `flutter analyze` 有與本計畫無關的既有錯誤（AqutterNativeHost.endpoint），未處理。
- 為了讓換日可測，額外對 LogService 加了可注入時鐘（使用者核准的 Iteration）。
- manifest 需另補 shell ref 的 chore commit，tag 才含這次的殼變更。

## Impact Files
- `shell/lib/src/bridge/log_service.dart:46`（append）、`:17`（_logDir）— target 驗證、provider 解析、可注入時鐘
- `shell/lib/src/bridge/bridge_registry.dart:380`（logAppend handler）— 選讀 target
- `shell/test/log_service_test.dart`（new）— 驗證、路徑組合、換檔、跨午夜
- `manifest/releases.json:24`（client.spec）、shell ref — 對齊新版

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/log-file.md` | 2026-10-29 | — | 日誌檔支援指定根目錄來源、子目錄與檔名 | — | — |
