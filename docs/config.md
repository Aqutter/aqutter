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
| `web.framework` | `vite` | `nuxt` / `vite` / `next` / `custom`；只是各欄位預設值的來源 |
| `web.devCommand` | 依框架 | 覆寫開發伺服器指令，見 [網頁指令](#網頁指令覆寫) |
| `web.buildCommand` | 依框架 | 覆寫產生靜態網頁的指令 |
| `web.prepareCommand` | — | `buildCommand` 之前的準備指令（選填） |
| `web.outputDir` | 依框架 | 靜態產物目錄 |
| `web.cleanDirs` | 依框架 | 每次產生種子前清空的目錄 |
| `web.custom` | — | 舊寫法：`framework` 為 `custom` 時的 `dev` / `generate` / `prepare`，等同上面三個指令欄位 |
| `environments` | `{}` | 命名環境，見 [環境](#環境environments)；由 `aqutter env add/remove` 維護 |
| `shell.path` | — | 本機殼目錄；`init --shell-path` 會把 App 的殼依賴改為 path |
| `shell.ref` | CLI 版本 | 殼的 git tag |
| `plugins` | `[]` | 已安裝 plugin；由 `aqutter plugin add/remove` 維護 |

## 網頁指令覆寫

框架（`web.framework`）只決定各欄位的**預設值**；任何一個欄位都可以自己寫：

```json
{
  "web": {
    "framework": "nuxt",
    "devCommand": "pnpm nuxt dev --dotenv={envFile} --port={port} --host",
    "buildCommand": "pnpm nuxt generate --dotenv={envFile}",
    "prepareCommand": "pnpm nuxt prepare",
    "outputDir": ".output/public"
  }
}
```

- 寫了 `devCommand` 就取代開發指令、寫了 `buildCommand`（與選填的 `prepareCommand`）就取代打包步驟；沒寫的仍用框架預設。指令交給 shell 執行，可以寫整串。
- 樣板變數：`{envFile}`、`{port}`、`{host}`（`buildCommand` / `prepareCommand` 只有 `{envFile}`）。
- 不寫 `framework` 也行，但這時沒有預設可依賴，必須同時給 `devCommand`、`buildCommand` 與 `outputDir`（產物目錄不會靜默退回 `dist` 之類的預設）。

**env 檔怎麼交給網頁指令**有兩條，共通且彼此獨立：

| 方式 | 說明 |
|---|---|
| 子行程環境變數 | CLI 讀 env 檔，把**每個鍵**放進網頁指令的環境變數（Vite 的 `VITE_*`、Next 的 `NEXT_PUBLIC_*` 等直接就讀得到）。指令字串不必提到 env 檔。另外一律帶 `DEV_PORT`，有區網位址時帶 `DEV_HOST` |
| 檔案路徑 `{envFile}` | 要「路徑」的工具（例如 Nuxt 的 `--dotenv=<檔>`）在指令裡寫 `{envFile}`。只有**沒覆寫**指令時，Nuxt 才會自動帶 `--dotenv`；一覆寫就要自己寫 |

## 環境（environments）

每個環境集中描述自己用到的東西：

```json
{
  "web": { "framework": "nuxt" },
  "environments": {
    "dev":  { "envFile": ".env/.env.dev" },
    "uat":  {
      "flavor": "uat",
      "signing": "signing/signing.uat.json",
      "web": { "buildCommand": "pnpm generate:uat", "outputDir": "dist-uat" }
    },
    "prod": { "flavor": "prod", "signing": "signing/signing.prod.json" }
  }
}
```

| 欄位 | 說明 |
|---|---|
| `envFile` | env 檔（相對專案根）；省略為 `<envDir>/.env.<名稱>` |
| `flavor` | 對應的 Flutter flavor |
| `signing` | 簽章設定檔，相對 `<appDir>/` |
| `web` | 覆蓋最上層 `web` 的欄位（`framework` / `devCommand` / `buildCommand` / `prepareCommand` / `outputDir` / `cleanDirs`），欄位層級合併、環境優先 |

名稱須為小寫字母開頭，其後為小寫字母、數字或連字號。

使用：`aqutter dev -e uat <target>`、`aqutter build -e uat apk`（`-e` 等同 `--env=`）。環境名會帶入它的 env 檔、flavor、簽章與網頁覆蓋；**明給的旗標優先**（`--flavor`、`--signing` 蓋過環境的設定）。`-e` 的值若不是環境名，就當成 env 檔路徑（相對專案根），不在設定檔也行，行為與以往相同；這個路徑恰好是某個環境的 `envFile` 時視為那個環境。

找不到時中止，不退回任何預設，並列出已設定的環境。`defaultDevEnv` / `defaultProdEnv` 也可以填環境名。

新增一個環境：`aqutter env add uat --flavor=uat`（見 [CLI](cli.md#aqutter-env)），或直接編輯設定檔、再自己建立 env 檔。沒有 `environments` 區塊的專案完全不受影響，仍用檔名慣例（`--x-env`）。

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
