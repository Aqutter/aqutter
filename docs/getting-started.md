# 快速開始

## 需求

| 項目 | 版本 |
|---|---|
| Node.js | ≥ 20 |
| Flutter | ≥ 3.47.0（Dart ≥ 3.13.0） |
| 目標平台工具鏈 | iOS / macOS：Xcode；Android：Android SDK；Windows：Visual Studio |

## 1. 安裝

CLI 與 client 以 GitHub 子目錄安裝（尚未發佈 npm）：

```bash
pnpm add -D "github:Aqutter/aqutter#0.2.1&path:/cli"
pnpm add "github:Aqutter/aqutter#0.2.1&path:/client"
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
