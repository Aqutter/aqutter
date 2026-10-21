# 快速開始

## 需求

| 項目 | 版本 |
|---|---|
| Node.js | ≥ 20 |
| Flutter | 3.47.4（Dart 3.13.x）。這是框架建置與測試用的基準版本：App 的 `pubspec.yaml` 要求 3.47.4 以上（低於此版本 `flutter pub get` 會直接報錯），不設上限——較新的 Flutter 可以嘗試，但框架尚未驗證，`aqutter doctor` 會提示。用什麼方式安裝與切換 Flutter 版本由你決定（官方安裝、[FVM](https://fvm.app) 等都可以，框架不要求任何特定工具） |
| 目標平台工具鏈 | iOS / macOS：Xcode；Android：Android SDK；Windows：Visual Studio |

## 1. 安裝

尚未發佈 npm，兩者都以 GitHub 安裝。

CLI 位於獨立 repo [`Aqutter/aqutter-cli`](https://github.com/Aqutter/aqutter-cli)，用 repo 根目錄安裝，四種套件管理器皆可：

```bash
npm i -D github:Aqutter/aqutter-cli#0.0.0
pnpm add -D github:Aqutter/aqutter-cli#0.0.0
yarn add -D github:Aqutter/aqutter-cli#0.0.0
bun add -D github:Aqutter/aqutter-cli#0.0.0
```

client 在本 repo 的子目錄，`&path:` 語法目前只有 pnpm 支援：

```bash
pnpm add "github:Aqutter/aqutter#0.0.0&path:/client"
```

npm / yarn / bun 專案目前無法直接安裝 client 子目錄，待 client 發佈或提供可用的安裝來源後再補上。

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

網頁載入完成後必須呼叫一次 `app_ready`，殼才會移除啟動過場（沒呼叫，畫面會一直停在「載入網頁」）：

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
