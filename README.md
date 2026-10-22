# Aqutter

把既有的網頁專案包成原生 App：網頁跑在 Flutter 殼的 WebView 裡，殼提供本機 server、OTA 網頁包更新、原生 bridge 與可擴充的 plugin。

## 組成

| 目錄 | 內容 |
|---|---|
| [`shell/`](shell) | Dart 套件 `aqutter`：`runAqutter()`、本機 server、OTA 更新、bridge handlers、plugin 介面 |
| [`Aqutter/aqutter-js`](https://github.com/Aqutter/aqutter-js)（獨立 repo） | npm 套件 `@aqutter/aqutter`：網頁端呼叫 bridge、訂閱事件、plugin API 與跨層契約型別 |
| [`Aqutter/aqutter-cli`](https://github.com/Aqutter/aqutter-cli)（獨立 repo） | npm 套件 `@aqutter/aqutter-cli`（指令 `aqutter`）：`init` / `dev` / `seed` / `build` / `flavor add` / `android gen-jks` / `plugin …` / `doctor` / `upgrade`；內含 Flutter App 與 plugin 範本，版本相容資訊讀自 [release manifest](docs/releases.md) |
| [`docs/`](docs) | 使用文件 |

WebView 本身由 [`aqutter_core`](https://github.com/Aqutter/aqutter_core) 提供。

## 快速開始

```bash
# 在既有網頁專案（Nuxt / Vite / Next / 自訂）內
# CLI 與 client 都以 repo 根目錄安裝，npm / pnpm / yarn 皆可（bun 尚未驗證）
pnpm add -D github:Aqutter/aqutter-cli#0.0.0
pnpm add github:Aqutter/aqutter-js#0.0.0

pnpm exec aqutter init --org=com.example
cp .env/.env.example .env/.env.dev
pnpm exec aqutter dev macos
```

詳見 [docs/getting-started.md](docs/getting-started.md)。

## 文件

- [快速開始](docs/getting-started.md)
- [設定檔 aqutter.config.json](docs/config.md)
- [CLI 指令與旗標](docs/cli.md)
- [環境變數與 dart-define](docs/environment.md)
- [Plugin 開發](docs/plugins.md)
- [Native view 鏡像](docs/nativeview.md)
- [建置、flavor 與簽章](docs/build-and-signing.md)
- [熱更新（OTA）](docs/hot-update.md)
- 平台：[Android](docs/android.md)、[iOS](docs/ios.md)、[macOS](docs/macos.md)、[Windows](docs/windows.md)、[Linux](docs/linux.md)

## 授權

Apache-2.0，見 [LICENSE](LICENSE) 與 [NOTICE](NOTICE)。
