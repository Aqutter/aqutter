# AGENTS.md

本 repo 是 Aqutter 框架的 monorepo；內容與慣例見 [README.md](README.md) 與 `.kn-project/project.md`。

## 紅線

1. **名稱定案**：npm 套件 `@aqutter/aqutter`（client）、`@aqutter/aqutter-cli`（CLI，指令 `aqutter`）；Dart 套件 `aqutter`（shell）；環境變數前綴 `AQUTTER_`；JS 全域 `window.aqutter`；channel 前綴 `com.github.aqutter/`。改名須同步 Dart、TS、範本、文件。
2. **跨語言名稱成對**：handler / 事件名稱存在於 `shell/lib/src/bridge/bridge_names.dart` 與 `client/src/contract/bridge.ts`，plugin 命名規則存在於 `shell/lib/src/plugin/aqutter_plugin.dart` 與 `client/src/index.ts`；只改一邊就是錯。
3. **env 鍵三處成對**：Dart `fromEnvironment` 鍵、`cli/template/env/.env.example`、`docs/environment.md`。
4. **`cli/dist/` 是發佈產物**：改 `cli/src` 或 `cli/template` 後必須 `pnpm --dir cli build` 並一併提交。
5. **範本變數**：`cli/template/app` 與 `cli/template/plugin` 內只能使用 `cli/src/commands/init.ts` / `plugin.ts` 提供的 `{{變數}}`，`cli/test/plugins.test.ts` 會檢查。

## 驗證指令

```bash
cd shell && flutter analyze && flutter test
cd client && pnpm typecheck
cd cli && pnpm typecheck && pnpm test && pnpm build
```

## 工作流程

目前開發階段直接推送 `main`，不開 PR / milestone / 版本分支；版本以 tag 標記（`shell`、`client`、`cli` 共用同一個 tag）。
