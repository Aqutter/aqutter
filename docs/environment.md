# 環境變數與 dart-define

同一份 env 檔由兩端各自原生讀取：網頁端由框架轉接器帶入，Flutter 端以 `--dart-define-from-file=<env 檔>` 於編譯期注入，Dart 以 `String.fromEnvironment` 讀取。

環境（dev / uat / prod…）怎麼命名、各自用哪個 env 檔、flavor 與簽章，見 [設定檔的環境](config.md#環境environments)；用 `-e <環境名>` 選用。

鍵的前綴即歸屬：`AQUTTER_*` 只有殼在讀；其餘鍵由網頁專案自己決定。範本在 `.env/.env.example`（`aqutter init` 產生）。

## 殼的鍵（Dart 編譯期）

| 鍵 | 預設 | 說明 |
|---|---|---|
| `AQUTTER_DEV_URL` | 空 | 非空即 dev 模式：WebView 直接載入此 URL，跳過種子 / OTA / 本機 server。由 `aqutter dev` 依平台注入，不必寫進 env 檔 |
| `AQUTTER_WEBVIEW_DEBUG` | `false` | 是否開放 WebView 遠端檢查（Android `chrome://inspect`、iOS 16.4+ / macOS 13.3+ Web Inspector、Windows DevTools）。非 `true` / `false` 啟動即報錯 |
| `AQUTTER_WEB_READY_TIMEOUT_SECONDS` | `300` | 頁面載入完成後等待 `app_ready` 的上限，逾時視為網頁包壞掉並回滾 |
| `AQUTTER_UPDATE_BASE_URL` | 空 | 熱更新遠端來源；空＝不啟用線上更新 |
| `AQUTTER_UPDATE_VERSION_PATH` | `version.json` | 版本查詢端點路徑（相對 BASE_URL） |
| `AQUTTER_UPDATE_METHOD` | `GET` | 版本查詢的 HTTP method：`GET` / `POST`；打錯即報錯 |
| `AQUTTER_UPDATE_API_KEY` | 空 | 鑑權值；空＝不帶鑑權 header。機密請放 git 忽略的 env 檔 |
| `AQUTTER_UPDATE_API_KEY_HEADER` | `X-Api-Key` | 承載 API KEY 的 header 名 |
| `AQUTTER_UPDATE_BUNDLE_AUTH` | `true` | 下載 bundle.zip 時是否也帶鑑權 header |
| `AQUTTER_UPDATE_REQUIRED` | `false` | 版本查詢必須成功才能進網頁；為 `true` 時 BASE_URL 不得為空 |
| `AQUTTER_UPDATE_CONNECT_TIMEOUT_SECONDS` | `30` | 更新伺服器連線逾時 |
| `AQUTTER_UPDATE_RECEIVE_TIMEOUT_SECONDS` | `600` | 網頁包下載接收逾時 |

契約細節見 [熱更新（OTA）](hot-update.md)。

## 行程環境變數（CLI）

見 [CLI 指令與旗標](cli.md#行程環境變數)。
