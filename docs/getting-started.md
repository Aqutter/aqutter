# 快速開始

## 需求

| 項目 | 版本 |
|---|---|
| Node.js | ≥ 20 |
| Flutter | 3.50.0（Dart 3.14.0）。這是框架建置與測試用的基準版本：App 的 `pubspec.yaml` 要求 3.50.0 以上（低於此版本 `flutter pub get` 會直接報錯），不設上限——較新的 Flutter 可以嘗試，但框架尚未驗證，`aqutter doctor` 會提示。用什麼方式安裝與切換 Flutter 版本由你決定（官方安裝、[FVM](https://fvm.app) 等都可以，框架不要求任何特定工具） |
| 目標平台工具鏈 | iOS / macOS：Xcode；Android：Android SDK；Windows：Visual Studio |
| 最低 iOS | 16.0。框架（`aqutter` 殼與 `aqutter_core`）的 iOS 部署目標為 16.0；App 的部署目標低於 16.0 時，CocoaPods 或 Swift Package Manager 解析會直接報錯 |

## 1. 安裝

尚未發佈 npm，CLI 與 client 都以 GitHub 安裝，各自在獨立 repo。

CLI 在 [`Aqutter/aqutter-cli`](https://github.com/Aqutter/aqutter-cli)，npm、pnpm、yarn 皆可（bun 尚未驗證，暫不支援）：

```bash
npm i -D github:Aqutter/aqutter-cli#0.0.0
pnpm add -D github:Aqutter/aqutter-cli#0.0.0
yarn add -D github:Aqutter/aqutter-cli#0.0.0
```

client 在 [`Aqutter/aqutter-js`](https://github.com/Aqutter/aqutter-js)，同樣用 repo 根目錄安裝：

```bash
npm i github:Aqutter/aqutter-js#0.0.0
pnpm add github:Aqutter/aqutter-js#0.0.0
yarn add github:Aqutter/aqutter-js#0.0.0
```

## 2. 初始化

在網頁專案根目錄：

```bash
pnpm exec aqutter init --org=com.example --display-name="My App"
```

`init` 會：

1. 偵測網頁框架（Nuxt / Next / Vite），寫入 `aqutter.config.json`
2. 由範本展開 Flutter App 目錄 `aqutter/`（含 android / ios / macos / windows / linux）
3. 寫入 `.env/.env.example`、補 `.gitignore`

重跑安全：已存在的檔案不會被覆寫（`--force` 除外）。

## 3. 開發

```bash
cp .env/.env.example .env/.env.dev
cd aqutter && flutter pub get && cd ..
pnpm exec aqutter dev macos          # 或 ios / android / windows / linux / 互動選單
```

`aqutter dev` 同時啟動網頁的 dev server 與 `flutter run`，把 dev server 位址以 `AQUTTER_DEV_URL` 注入殼。

## 4. 打包

```bash
pnpm exec aqutter build macos --env=.env/.env.prod
```

步驟：產生靜態網頁 → 打包成種子網頁包 → `flutter build` → 交付到 `artifacts/`。
簽章、flavor 與多環境見 [建置、flavor 與簽章](build-and-signing.md)。

## 5. 在網頁內呼叫原生

預設情況下，網頁載入完成後殼會自動移除啟動過場，**不必**呼叫 `app_ready`（殼等兩個繪製幀；單頁應用若 hydration 較慢，可能短暫看到尚未完成的畫面）。
想等網頁真的準備好才收起過場，就在準備好時呼叫一次 `app_ready`：

> 例外：有設定 `AQUTTER_UPDATE_BASE_URL`（使用熱更新）時，殼要求網頁呼叫 `app_ready`，沒呼叫就會停在「載入網頁」，逾時還會把網頁包視為壞掉並回滾。
> 可用 `AQUTTER_REQUIRE_APP_READY` 改變這個行為，見 [環境變數](environment.md)。

```ts
import { callFlutter } from '@aqutter/aqutter'
import { BridgeHandler } from '@aqutter/aqutter/contract'

await callFlutter(BridgeHandler.AppReady)
```

其他呼叫：

```ts
import { callFlutter, isFlutter } from '@aqutter/aqutter'
import { BridgeHandler } from '@aqutter/aqutter/contract'

if (isFlutter()) {
  const info = await callFlutter(BridgeHandler.PlatformInfo)
}
```

擴充原生能力請見 [Plugin 開發](plugins.md)。
