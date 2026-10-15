# 2610160130 - initial-release

- Created: 2026-10-16 / Archived: 2026-10-16
- Issue: N/A
- Milestone: N/A / Base Branch: main

## Summary
`aqutter` 0.1.0：Aqutter 框架的 monorepo，含 Flutter 殼 `shell/`、網頁端 `client/`、CLI 與範本 `cli/`、文件 `docs/`。CLI 以設定檔驅動、框架中立（Nuxt / Vite / Next / 自訂），涵蓋 init、dev、seed、build、flavor、Android keystore、簽章與 plugin 指令；殼提供 plugin 介面（handler、事件、原生 UI 疊層）。
repo 以單一初始 commit 建立，直接推送 `main`，未使用 issue、PR、milestone 或版本分支。

## Cross-Repo Scope
相依 `Aqutter/aqutter_core`（tag `0.1.0`）。範例 plugin 與範例 App 各為獨立 repo，以 git tag 依賴本 repo。

## Key Decisions
- **monorepo**：shell、client、CLI 同 repo、同 tag，避免契約字串兩端失同步。
- **範本放在 CLI 內**（`cli/template`）：以 GitHub 子目錄安裝 CLI 時範本隨之而來。
- **env 前綴 `AQUTTER_*`**，不提供舊鍵相容。
- **plugin 同時是 npm 與 Dart 套件**，Dart 端以 `node_modules` 內路徑依賴，單一發佈管道。
- **TS 以原始碼發佈**（client、plugin）；CLI 以 esbuild 打包並提交 `dist/`。

## Deviations
- 驗證範圍見 `project.md`；Windows、Linux、實體 iOS 裝置與簽章流程未實跑。

## Impact Files
- 全 repo（初始匯入）：`shell/**`、`client/**`、`cli/**`、`docs/**`、`README.md`、`AGENTS.md`、`NOTICE`、`LICENSE`、`.kn-project/**`
