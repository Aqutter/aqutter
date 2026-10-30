WIKI_PAGE("environment.md",{
"title":"環境變數",
"summary":"設定以 `.env.example` 為正本，共 12 個變數、1 個模組；secret 類只寫遮罩與長度，範例值一律是安全值。",
"svgs":{},
"seq":{},
"ext":[],
"changelog":[],
"md":"# 環境變數\n\n## Summary\n設定以 `.env.example` 為正本，共 12 個變數、1 個模組；secret 類只寫遮罩與長度，範例值一律是安全值。\n\n## 變數\n### Aqutter 殼（Dart 端以原 key 名 String.fromEnvironment 讀取；一律 AQUTTER_ 前綴）\n| 變數 | 用途 | 缺省影響 | 範例 |\n|---|---|---|---|\n| `AQUTTER_UPDATE_BASE_URL` | 熱更新遠端來源；留空＝不啟用線上更新（僅用種子 / 現有版本） | — | — |\n| `AQUTTER_UPDATE_VERSION_PATH` | 版本查詢的端點路徑，相對於 AQUTTER_UPDATE_BASE_URL。可為靜態檔或 API 路由 | — | `version.json` |\n| `AQUTTER_UPDATE_METHOD` | 版本查詢的 HTTP method：GET \\| POST。留空＝GET。 | — | `GET` |\n| `AQUTTER_UPDATE_API_KEY` | API KEY；留空＝不帶任何鑑權 header。機密請放 .env.prod（git 忽略） | — | — |\n| `AQUTTER_UPDATE_API_KEY_HEADER` | 承載 AQUTTER_UPDATE_API_KEY 的 header 名。留空＝X-Api-Key | — | `X-Api-Key` |\n| `AQUTTER_UPDATE_BUNDLE_AUTH` | 下載 bundle.zip 時是否也帶鑑權 header：true \\| false。留空＝true | — | `true` |\n| `AQUTTER_UPDATE_REQUIRED` | 是否要求版本查詢必須成功才能進網頁：true \\| false。留空＝false | — | `false` |\n| `AQUTTER_UPDATE_PUBLIC_KEYS` | 網頁包簽章的公鑰（Ed25519，標準 Base64 的 32 位元組原始公鑰，可用逗號分隔多把）。留空＝不驗簽章 | 設了就一律要求 version.json 帶 sha256 與 signature，缺少或驗證不過都拒絕更新並保留現行網頁包。 | — |\n| `AQUTTER_WEB_READY_TIMEOUT_SECONDS` | 網頁就緒的等待上限（秒）。留空＝300 | — | `300` |\n| `AQUTTER_WEBVIEW_DEBUG` | WebView 是否開放遠端檢查（true / false）。留空＝false | — | `false` |\n| `AQUTTER_UPDATE_CONNECT_TIMEOUT_SECONDS` | 更新伺服器的連線逾時（秒）。留空＝30 | — | `30` |\n| `AQUTTER_UPDATE_RECEIVE_TIMEOUT_SECONDS` | 網頁包下載的接收逾時（秒）。留空＝600 | — | `600` |\n\n來源：1. [env.example](../../docs/env.example)\n\n## 來源與載入順序\n1. 平台環境變數（CI／容器）最先。\n2. `.env.<flavor>` 覆寫平台值。\n3. 程式內預設值最後。\n\n## 環境差異\n無\n\n---\n[🏠 Wiki](index.md)\n<!-- generated: wiki-env-page.py 0ac59bc16d5f2ba487ad32776170d52393625b28973b57ed2dbad4d0dc5fffbf -->\n"
});
