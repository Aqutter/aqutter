<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# aqutter

Aqutter 框架的 monorepo：把既有網頁專案包成原生 App——網頁跑在 Flutter 殼的 WebView 內，殼提供本機 server、OTA 網頁包更新、原生 bridge 與 plugin 擴充。

## 組成

| 目錄 | 內容 |
| :--- | :--- |
| `shell/` | Dart 套件 `aqutter`：`runAqutter(config, plugins)`、`AqutterConfig`、本機 server、OTA 更新、bridge handlers、plugin 介面 |
| client | 已拆到獨立 repo [`Aqutter/aqutter-js`](https://github.com/Aqutter/aqutter-js)（npm 套件 `@aqutter/aqutter`：網頁端 bridge client、plugin API、跨層契約型別，TS 原始碼發佈）；本 repo 不再有 `client/` |
| `cli/` | CLI 已拆到獨立 repo [`Aqutter/aqutter-cli`](https://github.com/Aqutter/aqutter-cli)（npm 套件 `@aqutter/aqutter-cli`，指令 `aqutter`，含 `template/app`、`template/plugin` 範本與 `dist/`）；本 repo 不再有 `cli/` |
| `docs/` | 使用文件 |
| `manifest/` | release manifest（`releases.json`）與其 JSON Schema：框架各版本對應的 shell、aqutter_core、client 與 Flutter 版本，是版本相容性的唯一來源；由 CI 檢查。說明見 [發佈清單](wiki/ops/release-manifest.md) |

WebView 由獨立 repo `Aqutter/aqutter_core`（以 git tag 依賴）提供。

## 保留鐵則

- **名稱定案**：見 `AGENTS.md` 第 1 條；channel、handler、env 鍵、plugin 命名規則都是「兩種語言各存一份」的字串，只改一邊就是錯。
- **以 git 依賴發佈，不上 pub.dev / npm**：shell 與 plugin 都用 `git:`（`path: shell`、`ref: <tag>`）；client 以 `github:Aqutter/aqutter-js#<ref>`、CLI 以 `github:Aqutter/aqutter-cli#<ref>` 安裝（皆為 repo 根目錄，npm、pnpm、yarn 皆可；bun 尚未驗證）。shell 的版本 tag 在本 repo，client、CLI 各有自己的 tag；開發階段版本固定為 `0.0.0`（tag `0.0.0` 隨 `main` 前進）。版本相容性以 `manifest/releases.json` 為準，其 ref 一律是 commit sha。
- **CLI 在 `Aqutter/aqutter-cli`**：其 `dist/` 必須與 `src/`、`template/` 同步提交；CLI 不寫死任何網頁框架，只認 `aqutter.config.json`。跨 repo 的成對規則（env 鍵、Flutter 版本、範本變數）見 `AGENTS.md`，目前只靠文件約束，沒有跨 repo CI。
- **env 範圍**：`AQUTTER_*` 只有殼讀；dev 連線位址 `AQUTTER_DEV_URL` 由 `aqutter dev` 依平台注入。
- **Native view 鏡像**：原生端在 `aqutter_core`（`AqutterNative`，以 tag 依賴），網頁端在 client（`Aqutter/aqutter-js`，`<aqutter-native>`、`AqutterNative`）；幀格式與訊息格式兩端各存一份（`native_frame.dart` ↔ aqutter-js 的 `src/nativeview/frame.ts`、`gestures.ts`），改一邊必改另一邊。`import '@aqutter/aqutter'` 必須在伺服端渲染下安全，故元素類別只在 `defineAqutterNative()` 內建立。
- **Plugin**：同一個 repo 同時是 npm 套件與 Dart 套件；`aqutter plugin add` 把 Dart 端以 path 依賴指向 `node_modules` 內的套件，並產生 `lib/aqutter_plugins.dart`。

## 工作流程

目前開發階段直接推送 `main`，不開 PR、milestone 或版本分支；版本以 tag `0.0.0` 標記。

## 驗證

```bash
cd shell && flutter analyze && flutter test
```

已驗證：
- 範例網頁專案（Vite）`init` → `seed` → `build macos` 成功、`plugin create/add/remove` 與 App `flutter analyze` 通過。
- 全新專案 `demo-app`（Vite，從 GitHub 安裝 CLI、client 與三個 plugin）在三個平台都能 `aqutter dev`：
  - **macOS**：mirror-demo 的幀與手勢往返、plugin 方法與事件（自測腳本）。
  - **Android 模擬器（Android 16，HCPP）**：三個 plugin 都註冊；battery 回傳電量與狀態；mirror-demo 的鏡像（純 Flutter widget 經 `RepaintBoundary`）、HTML 疊在其上、實際點擊與滑動都有作用。
  - **iOS 模擬器（iPhone 17）**：App 建置、安裝並載入網頁，兩個 plugin 註冊（`haptics=true battery=true`）；mirror-demo 的鏡像、點擊與滑動有作用；iOS 原生的 `AqutterNativeCapture.swift` 編譯通過。battery 在模擬器回傳 `UNAVAILABLE`（模擬器沒有電池資訊），錯誤有如實傳回網頁。
- 首次在 WebKit 載入 Nuxt dev server 會因 Vite 冷快取出現 `currentRenderingInstance` 的錯誤畫面，重啟後正常（Chrome 不會）。
- Windows（2026-10-21、22）：`aqutter dev windows` 與 release 建置都能啟動，三個 plugin（battery、haptics、mirror-demo）可呼叫，鏡像約 26 fps（release，見 [Windows](../docs/windows.md)）。
- Linux（2026-10-22）：WSL2 + WSLg 上的 Debian 13（debug），網頁、檔案選取、影片、鏡像可用；環境需求與已知問題見 [Linux](../docs/linux.md)。
未驗證：實體 Linux 機器與 Linux release、Ubuntu、實體 iOS 裝置、觸覺回饋的實際震動、iOS `drawHierarchy` 與 Android PlatformView 的擷取路徑（demo 鏡像的是 Flutter widget）、Android 與 iOS 的簽章流程、Nuxt 與 Next 轉接器的實跑。
