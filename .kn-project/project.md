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
- **以 git 依賴發佈，不上 pub.dev / npm**：shell 與 plugin 都用 `git:`（`path: shell`、`ref: <tag>`）；client 與 CLI 以 `github:Aqutter/aqutter#<tag>&path:/<dir>` 安裝。三者共用同一個版本 tag；開發階段版本固定為 `0.0.0`（tag `0.0.0` 隨 `main` 前進）。
- **CLI 的 `dist/` 必須與 `src/`、`template/` 同步提交**（使用者直接從 GitHub 安裝，沒有編譯步驟）。
- **設定驅動、框架中立**：CLI 不寫死任何網頁框架，框架差異只在 `cli/src/web.ts` 的轉接器；其餘指令只認 `aqutter.config.json`。
- **env 範圍**：`AQUTTER_*` 只有殼讀；dev 連線位址 `AQUTTER_DEV_URL` 由 `aqutter dev` 依平台注入。
- **Native view 鏡像**：原生端在 `aqutter_core`（`AqutterNative`，以 tag 依賴），網頁端在 client（`<aqutter-native>`、`AqutterNative`）；幀格式與訊息格式兩端各存一份（`native_frame.dart` ↔ `client/src/nativeview/frame.ts`、`gestures.ts`），改一邊必改另一邊。`import '@aqutter/aqutter'` 必須在伺服端渲染下安全，故元素類別只在 `defineAqutterNative()` 內建立。
- **Plugin**：同一個 repo 同時是 npm 套件與 Dart 套件；`aqutter plugin add` 把 Dart 端以 path 依賴指向 `node_modules` 內的套件，並產生 `lib/aqutter_plugins.dart`。

## 工作流程

目前開發階段直接推送 `main`，不開 PR、milestone 或版本分支；版本以 tag `0.0.0` 標記。

## 驗證

```bash
cd shell && flutter analyze && flutter test
cd client && pnpm typecheck && pnpm test
cd cli && pnpm typecheck && pnpm test && pnpm build
```

已驗證：
- 範例網頁專案（Vite）`init` → `seed` → `build macos` 成功、`plugin create/add/remove` 與 App `flutter analyze` 通過。
- 全新專案 `demo-app`（Vite，從 GitHub 安裝 CLI、client 與三個 plugin）在三個平台都能 `aqutter dev`：
  - **macOS**：mirror-demo 的幀與手勢往返、plugin 方法與事件（自測腳本）。
  - **Android 模擬器（Android 16，HCPP）**：三個 plugin 都註冊；battery 回傳電量與狀態；mirror-demo 的鏡像（純 Flutter widget 經 `RepaintBoundary`）、HTML 疊在其上、實際點擊與滑動都有作用。
  - **iOS 模擬器（iPhone 17）**：App 建置、安裝並載入網頁，兩個 plugin 註冊（`haptics=true battery=true`）；mirror-demo 的鏡像、點擊與滑動有作用；iOS 原生的 `AqutterNativeCapture.swift` 編譯通過。battery 在模擬器回傳 `UNAVAILABLE`（模擬器沒有電池資訊），錯誤有如實傳回網頁。
- 首次在 WebKit 載入 Nuxt dev server 會因 Vite 冷快取出現 `currentRenderingInstance` 的錯誤畫面，重啟後正常（Chrome 不會）。
未驗證：Windows、Linux、實體 iOS 裝置、觸覺回饋的實際震動、iOS `drawHierarchy` 與 Android PlatformView 的擷取路徑（demo 鏡像的是 Flutter widget）、Android 與 iOS 的簽章流程、Nuxt 與 Next 轉接器的實跑。
