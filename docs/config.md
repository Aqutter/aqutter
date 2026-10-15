# 設定檔 aqutter.config.json

位於網頁專案根目錄，由 `aqutter init` 建立。所有欄位都有預設值；只寫要改的部分。CLI 從目前目錄往上找這個檔案。

| 欄位 | 預設 | 說明 |
|---|---|---|
| `appDir` | `aqutter` | Flutter App 目錄（相對專案根） |
| `envDir` | `.env` | env 檔目錄 |
| `defaultDevEnv` | `.env/.env.dev` | `dev` / `seed` 未指定 `--env` 時使用 |
| `defaultProdEnv` | `.env/.env.prod` | `build` 未指定 `--env` 時使用 |
| `defaultPort` | `3000` | dev server 埠，可被 `--port` 覆寫 |
| `artifactsDir` | `artifacts` | 打包產物交付目錄 |
| `artifactName` | `app` | 交付檔名前綴：`<name>_<env>[_<flavor>]_<version>.<ext>` |
| `web.framework` | `vite` | `nuxt` / `vite` / `next` / `custom` |
| `web.outputDir` | 依框架 | 靜態產物目錄 |
| `web.cleanDirs` | 依框架 | 每次產生種子前清空的目錄 |
| `web.custom` | — | `framework` 為 `custom` 時的指令樣板 |
| `shell.path` | — | 本機殼目錄；`init --shell-path` 會把 App 的殼依賴改為 path |
| `shell.ref` | CLI 版本 | 殼的 git tag |
| `plugins` | `[]` | 已安裝 plugin；由 `aqutter plugin add/remove` 維護 |

## 框架轉接器

| framework | dev server | 產生靜態網頁 | 預設產物目錄 | env 帶入方式 |
|---|---|---|---|---|
| `nuxt` | `nuxt dev --dotenv=<env> --port=<n> --host` | `nuxt prepare` → `nuxt generate --dotenv=<env>` | `.output/public` | `--dotenv` |
| `vite` | `vite --port <n> --strictPort --host` | `vite build` | `dist` | 注入子行程環境 |
| `next` | `next dev -p <n> -H 0.0.0.0` | `next build`（需 `output: 'export'`） | `out` | 注入子行程環境 |
| `custom` | `web.custom.dev` | `web.custom.prepare`（選填）→ `web.custom.generate` | `web.outputDir`（必填） | 注入子行程環境 |

三個框架都會收到 `DEV_PORT`（dev server 埠）與 iOS 實機時的 `DEV_HOST`，供專案設定（CSP、HMR）使用。

`custom` 的指令樣板可用 `{envFile}`、`{port}`、`{host}`：

```json
{
  "web": {
    "framework": "custom",
    "outputDir": "build",
    "custom": {
      "dev": "my-dev --port {port}",
      "generate": "my-build --env {envFile}"
    }
  }
}
```
