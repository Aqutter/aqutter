# 環境變數

## Summary
設定以 `.env.example` 為正本，共 11 個變數、1 個模組；secret 類只寫遮罩與長度，範例值一律是安全值。

## 變數
### Aqutter 殼（Dart 端以原 key 名 String.fromEnvironment 讀取；一律 AQUTTER_ 前綴）
| 變數 | 用途 | 缺省影響 | 範例 |
|---|---|---|---|
| `AQUTTER_UPDATE_BASE_URL` | 熱更新遠端來源；留空＝不啟用線上更新（僅用種子 / 現有版本） | — | — |
| `AQUTTER_UPDATE_VERSION_PATH` | 版本查詢的端點路徑，相對於 AQUTTER_UPDATE_BASE_URL。可為靜態檔或 API 路由 | — | `version.json` |
| `AQUTTER_UPDATE_METHOD` | 版本查詢的 HTTP method：GET \| POST。留空＝GET。 | — | `GET` |
| `AQUTTER_UPDATE_API_KEY` | API KEY；留空＝不帶任何鑑權 header。機密請放 .env.prod（git 忽略） | — | — |
| `AQUTTER_UPDATE_API_KEY_HEADER` | 承載 AQUTTER_UPDATE_API_KEY 的 header 名。留空＝X-Api-Key | — | `X-Api-Key` |
| `AQUTTER_UPDATE_BUNDLE_AUTH` | 下載 bundle.zip 時是否也帶鑑權 header：true \| false。留空＝true | — | `true` |
| `AQUTTER_UPDATE_REQUIRED` | 是否要求版本查詢必須成功才能進網頁：true \| false。留空＝false | — | `false` |
| `AQUTTER_WEB_READY_TIMEOUT_SECONDS` | 網頁就緒的等待上限（秒）。留空＝300 | — | `300` |
| `AQUTTER_WEBVIEW_DEBUG` | WebView 是否開放遠端檢查（true / false）。留空＝false | — | `false` |
| `AQUTTER_UPDATE_CONNECT_TIMEOUT_SECONDS` | 更新伺服器的連線逾時（秒）。留空＝30 | — | `30` |
| `AQUTTER_UPDATE_RECEIVE_TIMEOUT_SECONDS` | 網頁包下載的接收逾時（秒）。留空＝600 | — | `600` |

來源：1. [.env.example](../../cli/template/env/.env.example)

## 來源與載入順序
1. 平台環境變數（CI／容器）最先。
2. `.env.<flavor>` 覆寫平台值。
3. 程式內預設值最後。

## 環境差異
無

---
[🏠 Wiki](index.md)
<!-- generated: wiki-env-page.py 406d872d3601bc13df8323782e01897cb1265e88cff7b2f4380b6434494cddd6 -->
