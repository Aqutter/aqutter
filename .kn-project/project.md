<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# aqutter

Aqutter 框架的 monorepo：把既有網頁專案包成原生 App——網頁跑在 Flutter 殼的 WebView 內，殼提供本機 server、OTA 網頁包更新、原生 bridge 與 plugin 擴充。

## 組成

| 目錄 | 內容 |
| :--- | :--- |
| `shell/` | Dart 套件 `aqutter`：`runAqutter(config, plugins)`、`AqutterConfig`、本機 server、OTA 更新、bridge handlers、plugin 介面 |
| `client/` | npm 套件 `@aqutter/aqutter`：網頁端 bridge client、plugin API、跨層契約型別（TS 原始碼發佈） |
| `cli/` | npm 套件 `@aqutter/aqutter-cli`（指令 `aqutter`）：`init` / `dev` / `seed` / `build` / `flavor add` / `android gen-jks` / `plugin …`，內含 `template/app`（Flutter App 範本）與 `template/plugin`（plugin 範本）；`dist/` 為 esbuild 打包產物並納入版控 |
| `docs/` | 使用文件 |

WebView 由獨立 repo `Aqutter/aqutter_core`（以 git tag 依賴）提供。

## 保留鐵則

- **名稱定案**：見 `AGENTS.md` 第 1 條；channel、handler、env 鍵、plugin 命名規則都是「兩種語言各存一份」的字串，只改一邊就是錯。
- **以 git 依賴發佈，不上 pub.dev / npm**：shell 與 plugin 都用 `git:`（`path: shell`、`ref: <tag>`）；client 與 CLI 以 `github:Aqutter/aqutter#<tag>&path:/<dir>` 安裝。三者共用同一個版本 tag。
- **CLI 的 `dist/` 必須與 `src/`、`template/` 同步提交**（使用者直接從 GitHub 安裝，沒有編譯步驟）。
- **設定驅動、框架中立**：CLI 不寫死任何網頁框架，框架差異只在 `cli/src/web.ts` 的轉接器；其餘指令只認 `aqutter.config.json`。
- **env 範圍**：`AQUTTER_*` 只有殼讀；dev 連線位址 `AQUTTER_DEV_URL` 由 `aqutter dev` 依平台注入。
- **Plugin**：同一個 repo 同時是 npm 套件與 Dart 套件；`aqutter plugin add` 把 Dart 端以 path 依賴指向 `node_modules` 內的套件，並產生 `lib/aqutter_plugins.dart`。

## 工作流程

目前開發階段直接推送 `main`，不開 PR、milestone 或版本分支；版本以 tag 標記。

## 驗證

```bash
cd shell && flutter analyze && flutter test
cd client && pnpm typecheck
cd cli && pnpm typecheck && pnpm test && pnpm build
```

已驗證：範例網頁專案（Vite）`init` → `seed` → `build macos` 成功、`plugin create/add/remove` 與 App `flutter analyze` 通過。
未驗證：Windows、Linux、實體 iOS 裝置、Android 與 iOS 的簽章流程、Nuxt 與 Next 轉接器的實跑。
