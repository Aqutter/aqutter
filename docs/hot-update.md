# 熱更新（Web bundle OTA）

只更新可寫目錄中的網頁包，不動 App 二進位、不需重上架。

## 目錄結構（app support dir）

```
web/
├─ current/          ← shelf server 的 documentRoot（正在服務的版本）
│  └─ version.json   ← { "version": "..." }
├─ next/             ← 遠端更新下載解壓的暫存區，驗證後原子換名為 current
└─ seed-next/        ← 種子解壓的暫存區（與遠端更新分開，避免殘留互相污染）
```

## 版本識別

版本為 `YYMMDDHHmmss`（**UTC**）定長時戳，字典序即時序，故可直接以字串比較判斷新舊。
取 UTC 是為了讓跨時區的建置機／CI 產出的版本大小與實際先後一致；取到秒是為了讓
同一分鐘內的重新打包仍能被辨識為新版。

`aqutter seed` 於打包時產生，同一個值寫兩處：

- **zip 根的 `version.json`** — 解壓後成為 `current/version.json`，是遠端更新的比對基準。
- **zip 外的 `assets/seed/seed-version.json`** — 供冷啟不載入整包即可得知種子版本。
  刻意獨立：若要靠算 zip 的 hash 判定，每次冷啟都得把整包載入記憶體。

## 流程（`lib/server/bundle_manager.dart`）

共用的解壓、版本解析與原子換名收攏於 `lib/server/bundle_archive.dart`，
種子與遠端更新走同一套。

1. `ensureCurrent()` → `SeedBootstrapper.ensureSeed()`：
   - `current/` 為空 → 解壓種子（首開）。
   - 種子版本 **大於** `current/version.json` → 解壓覆蓋（App 升版帶來較新的網頁包）。
   - 否則不動。判準刻意是「種子確實較新」而非「版本不一致」——使用者可能已透過
     熱更新取得比種子更新的網頁包，無條件覆蓋會把他們踢回 App 內建的舊版。
   - 解壓一律先進 `seed-next/` 再原子換名，中途失敗不會毀掉可服務的版本。
2. 冷啟的更新檢查（`main.dart` 啟動時、掛 WebView **前**）——`check()` → `download()` → `applyPending()`，
   `checkForUpdate(config)` 是同一組步驟的一條龍包裝：
   - 依 `BundleUpdateConfig` 查詢 `{BASE}/{VERSION_PATH}` → `{ version, url, sha256, size?, host? }`
   - 回應含 `host` 且合併本平台覆寫後的 `minBuildNumber` **大於**本機殼的 build number → 拋
     `HostTooOldException`，**不下載、不掛網頁**，改顯示阻擋畫面（見下方「強制更新殼」）。
     這一步在比對網頁包版本**之前**：強制更新殼是伺服器驅動的決定，不因「這次剛好沒新網頁包」而略過。
   - 與 `current/version.json` 的 `version` 比對；遠端**不大於**本地則跳過。
   - 較新 → 下載 `url`（bundle.zip）→ 驗 `sha256`（設了簽章公鑰時另驗 `signature`，見下方「簽章」）→ 解壓到 `next/` 並寫入標記檔 `.ready` → 套用：
     `current/` rename 為 `previous/`、`next/` rename 為 `current/`。
   - 任一步失敗保留舊 `current/`（rollback 安全）。標記檔缺席的 `next/`（解到一半被殺）視為殘渣清掉。
   - `size` 供網頁端在下載前顯示總大小；下載期間仍以 content-length 為準，只在其缺席時回退用 `size`。
   - 冷啟在種子就緒之後、查版本之前，會先把上次「下載完但沒套用」（見下方 `apply:false`）的 `next/`
     套用掉——仍比對版本，`next/` 不比 `current/` 新（種子已升到更新版）就丟棄。

遠端契約全部由 `.env/.env.<profile>` 決定（見下方「啟用」），設定物件為
`lib/server/update_config.dart` 的 `BundleUpdateConfig`。GET / POST 共用
`_dio.request()` 同一條路徑，method 交由 `Options` 決定，避免兩種模式各長出
一條會逐漸分歧的分支。

> **兩個判斷都用「大於」是必要的，不是對稱美感。** 種子與 OTA 是兩個獨立的無狀態
> 判斷，各自每次冷啟重算。若 OTA 改回「不相等即套用」，遇上帶有較新種子的 APK
> 會形成互踩：`種子覆蓋 → OTA 蓋回舊版 → 下次冷啟再來一次`，每次啟動都付出完整
> 解壓與完整下載，使用者還永遠停在舊版。
>
> 代價：伺服器無法以「調低版本號」做 rollback，需把舊內容以**新時戳**重新發佈。

## 簽章（防止更新來源被入侵或被換包）

`sha256` 與 bundle.zip 來自同一台伺服器，只能發現傳輸損壞，**擋不住伺服器本身被換掉內容**；而網頁包能直接執行並呼叫 bridge。所以殼可以內置公鑰，只接受你用私鑰簽過的網頁包。

| 項目 | 說明 |
| :--- | :--- |
| 演算法 | Ed25519（RFC 8032） |
| 簽章欄位 | `version.json` 的 `signature`：標準 Base64，解碼後 64 位元組 |
| 簽章訊息 | UTF-8 的 `aqutter-bundle-v1\n{version}\n{sha256 小寫十六進位}\n`。版本被簽進去，舊包不能貼上新版本號 |
| 公鑰 | 編譯期 `AQUTTER_UPDATE_PUBLIC_KEYS`（見[環境變數](environment.md)），逗號分隔可多把，任一把通過即可（金鑰輪替）。**網頁不能改它**，`update_config_set` 也碰不到 |
| 沒設公鑰 | 行為與以前完全相同：有 `sha256` 就驗，沒有就不驗，`signature` 被忽略 |
| 設了公鑰 | `sha256` 與 `signature` 缺一不可；雜湊不符、簽章缺失、格式錯、驗證不過都拒絕，不解包、不動現行網頁包，走和下載失敗相同的路徑（非嚴格模式續用舊版；嚴格模式進「無法確認版本」阻擋頁） |
| 種子網頁包 | 隨 App 打包，視為可信，不驗簽章 |
| APK（`updateSha256`） | 不在這個機制內：Android 安裝時由系統比對簽署憑證，換包的 APK 會被擋下 |

簽署端用 CLI：`aqutter bundle keygen` 產生金鑰對（私鑰只留在簽署端，公鑰填進 env），`aqutter bundle sign <bundle.zip> --key <私鑰>` 印出要放進 `version.json` 的 `version`、`sha256`、`signature`。

> **上線順序**：已設公鑰的 App 遇到沒有簽章的 `version.json` 會一律拒絕更新。要先讓伺服器的 `version.json` 帶上簽章，再發佈帶公鑰的新 App。

## 執行期更新（App 內完成，不需重啟）

網頁端可主動驅動整條流程，每個階段以 bridge 事件 `update_state` 推回網頁顯示
（`lib/server/update_session.dart`；網頁端的封裝見 `useAppBundle`）。
指令 handler 只回報**是否受理** `{ accepted, reason? }`，之後看事件；未受理代表什麼都不會發生
（`reason`：`dev` / `disabled` / `busy` / `no_pending` / `not_checked` / `no_host_update` / `no_apk` / `invalid_config`）。

| handler | 參數 | 行為 |
| :--- | :--- | :--- |
| `bundle_check_update` | — | 純查詢，回 `{ hasUpdate, currentVersion, remoteVersion, size, host?, error? }`；`host.blocked` 為 true 代表殼過舊（查詢時只是事實，不阻擋） |
| `bundle_download_update` | `{ apply?: true }` | 查版本 → 背景下載 → 驗 sha256 → 解包到 `next/`，**WebView 全程在線**；`apply:true`（預設）接著套用，`false` 停在 `ready` |
| `bundle_apply_update` | — | 套用 `next/`；沒有待套用的網頁包時退回一條龍（＝`bundle_download_update({apply:true})`），改版前的網頁呼叫維持原意 |
| `host_download_update` | `{ install?: true }` | 依上次查詢的 `host` 區塊背景下載 APK 並驗 sha256（Android + `updateType: apk` 限定）；`install:true`（預設）接著喚起安裝器 |
| `host_install_update` | — | 安裝已下載的 APK |

`update_state` payload：`{ target: 'bundle'|'host', stage, received?, total?, percent?, done?, extractTotal?, currentVersion?, remoteVersion?, error? }`，
`stage` ∈ `checking` / `up_to_date` / `available` / `host_too_old` / `downloading` / `verifying` / `extracting` / `ready` / `applying` / `failed`。
進度以整數百分比節流（總量未知時每 256 KB 一次）——回呼很密集，逐次 `evaluateJavascript` 會拖慢下載本身。

套用（`applying`）是整條流程中**唯一**需要網頁不在的一段：

1. 廣播 `applying` 後**卸下 WebView**——此後畫面由 Flutter 的過場接管。
2. 停止 shelf server，釋放 documentRoot。
3. `applyPending()`：`current/` → `previous/`、`next/` → `current/`。
4. 以新內容重啟 server，把 WebView 掛回去。

先卸 WebView 才換目錄是刻意的：此時已無 in-flight 請求，可避開「server 服務中
刪除 documentRoot」的競態與 Windows 的檔案鎖定。套用失敗時 `current/` 仍在，
會以舊版重新掛回。下載與解包都在 `next/`，與服務中的 `current/` 互不相干，故可在網頁活著時背景做。

同時只允許一條流程（冷啟檢查中、或網頁端連按）：第二條以 `busy` 拒絕而非排隊。
殼過舊時 `bundle_download_update` 仍會切到原生阻擋畫面（阻擋是伺服器強制的安全閘，不靠網頁端自律）；
網頁端想自己畫，走 `bundle_check_update` 看 `host.blocked` 並以 `host_download_update` 下載。

`bundle_info` 另提供 `{ currentVersion, seedVersion, hostVersion, hostBuildNumber }` 供網頁端顯示——
後兩者是殼自己的 versionName 與 build number（`package_info_plus`，`lib/server/host_version.dart`）。
網頁包的「是否要更新」不在原生層決定——由遠端 API 回傳的內容決定，前端自行判斷何時呼叫；
**殼**的強制更新則由伺服器透過版本回應的 `host` 區塊宣告，原生層執行阻擋。

## 切換版更伺服器（執行期覆寫端點）

版更端點預設來自編譯期 env（`AQUTTER_UPDATE_*`）。網頁端可在執行期覆寫它，讓同一個 App 對應多台伺服器
（`lib/server/update_config_store.dart`；網頁端見 `useAppBundle` 的 `getUpdateConfig` / `setUpdateConfig` / `resetUpdateConfig`）。

| handler | 參數 | 行為 |
| :--- | :--- | :--- |
| `update_config_get` | — | 回目前生效的 `{ overridden, baseUrl, versionPath, method, apiKeyHeader, hasApiKey, enabled, defaults }`；**不回傳 API KEY 值** |
| `update_config_set` | `{ baseUrl, versionPath?, method?, apiKey?, apiKeyHeader? }` | 覆寫端點；回 `{ accepted, reason, error }` |
| `update_config_reset` | — | 清除覆寫，回到編譯期預設 |

- **語意**：覆寫持久化於 `shared_preferences`（鍵 `host.updateConfigOverride`，API KEY 為明文），冷啟自動沿用；設定後立即影響之後的 `bundle_check_update` / `bundle_download_update` / `host_download_update`。切換後可直接手動檢查。
- **缺席欄位**沿用編譯期預設，**API KEY 例外**：缺席即不帶 KEY，不會把原伺服器的 KEY 送給新網域。`AQUTTER_UPDATE_REQUIRED`、`AQUTTER_UPDATE_BUNDLE_AUTH` 不開放覆寫。
- **驗證**：`baseUrl` 必為含 host 的 http(s) 絕對 URL 且不得為空（要停用請 reset 回預設）；`method` 嚴格解析。失敗回 `reason: 'invalid_config'` 與 `error`，既有覆寫不受影響。cleartext 是否放行由平台 `network_security_config` 決定。
- **拒絕**：更新流程進行中回 `busy`；dev 模式回 `dev`。預設未配置（`disabled`）的 App 仍可靠 `update_config_set` 啟用。
- **不降版**：沿用「遠端版本較新才套用」。切到版本較舊的伺服器只會得到「已是最新」，不會降版；要降版須由該伺服器以新時戳重新發佈。
- 換端點會清掉上次查詢結果與已下載的 APK（屬於舊伺服器），需重新 `bundle_check_update` 才能 `host_download_update`。

## 強制更新殼（`host` 區塊）

版本回應可帶選填的 `host` 物件。頂層欄位是**全平台預設**，`host[<platform>]`（鍵名同
`Platform.operatingSystem`：`android` / `ios` / `windows` / `macos` / `linux`）**逐欄覆寫**；
殼依自己的平台合併後使用（`lib/server/host_requirement.dart`）。

```json
{
  "version": "260911063945", "url": "https://…/bundle.zip", "sha256": "<hex>", "signature": "<base64，設了公鑰才需要>", "size": 1234567,
  "host": {
    "minBuildNumber": 3,
    "updateUrl": "https://example.com/download",
    "android": { "updateUrl": "https://…/app_production_1.0.1.apk", "updateType": "apk", "updateSha256": "<hex>", "updateSize": 45678901 },
    "ios":     { "updateUrl": "itms-services://?action=download-manifest&url=…" },
    "windows": { "minBuildNumber": 5, "updateUrl": "https://…/app_production_1.0.1.msix" }
  }
}
```

| 欄位 | 缺席時 | 說明 |
| :--- | :--- | :--- |
| `minBuildNumber` | 不限制 | 本網頁包所需的最低殼 build number（整數）。以 build number 而非 versionName 比對：單調、無 semver 解析歧義 |
| `updateUrl` | 阻擋畫面只顯示訊息、無按鈕 | 更新管道的 URL |
| `updateType` | `external` | `external`＝`url_launcher` 開外部連結（商店頁、`itms-services://`、下載頁）；`apk`＝**非上架 Android**，App 內下載後喚起系統安裝器；非 Android 收到 `apk` 退回 `external` |
| `updateSha256` | 不驗 | `apk` 型別的安裝檔 sha256 |
| `updateSize` | 未知 | 安裝檔大小（bytes），供網頁端下載前顯示；下載期間仍以 content-length 為準 |

為何巢狀而非扁平：GET 模式的靜態 `version.json` 只有一份，扁平欄位無法同時給 Android APK 與
iOS `itms-services://`，各平台的 build number 也不該假設一致。POST 模式伺服器已知 `platform`，
可只寫頂層欄位。

**阻擋的語意是硬性的**：殼不足時不掛網頁、畫面沒有出口，唯一的路是更新殼
（`lib/ui/host_update_screen.dart`）。本機 build number 不是整數（如某些 iOS 的
`CFBundleVersion`）時視為**無法比對、不阻擋**——把它當最舊會鎖死所有這類安裝。

`apk` 管道（`lib/server/host_updater.dart`）：dio 下載到 cache 的 `host-update/update.apk`
（鑑權 header 沿用 `AQUTTER_UPDATE_BUNDLE_AUTH` 的規則——APK 多半與網頁包在同一個私有伺服器）
→ 驗 `updateSha256` → MethodChannel `install_apk` → 原生以 FileProvider content URI +
`ACTION_VIEW` 喚起系統安裝器。「安裝未知來源」未授權時由系統安裝器自行引導到設定頁，殼不另做
權限流程；使用者取消回來後阻擋畫面仍在，再按一次直接沿用已下載且驗過的檔案。
**新舊 APK 簽章必須相同**，否則安裝器拒絕升級（由 [build-and-signing.md](build-and-signing.md) 的流程保證）。
需要的 Android 宣告：`REQUEST_INSTALL_PACKAGES` 權限、`FileProvider`（白名單 `res/xml/file_paths.xml`）。

Windows / macOS 非上架的自主更新本期只做 `external`（開下載頁或安裝檔連結），不做 App 內安裝。

## 啟用

於網頁專案根目錄的 `.env/.env.<profile>` 設定，經 `--dart-define-from-file` 於編譯期帶入
（`.env/.env.example` 有完整說明）：

```dotenv
AQUTTER_UPDATE_BASE_URL=https://your-cdn.example.com/app
AQUTTER_UPDATE_VERSION_PATH=version.json
AQUTTER_UPDATE_METHOD=GET
AQUTTER_UPDATE_API_KEY=
AQUTTER_UPDATE_API_KEY_HEADER=X-Api-Key
AQUTTER_UPDATE_BUNDLE_AUTH=true
```

`AQUTTER_UPDATE_BASE_URL` 留空＝停用線上更新，此時種子是唯一交付管道；App 照常啟動，版本查詢、殼版本閘與下載整段不會發生。其餘鍵**全部有預設值**。

版本查詢失敗預設**非致命**：只記錄並續用現有版本。要反過來「查詢不成功就不准進網頁」（離線就不該能用、或必須確保版本一致的 App），設 `AQUTTER_UPDATE_REQUIRED=true`——此時即使本機已有種子包也不放行，殼進「無法確認版本」阻擋頁並提供重試；冷啟與網頁端按「執行更新」兩條路徑同樣處理。它與 `AQUTTER_UPDATE_BASE_URL` 留空是矛盾配置，啟動即拋 `ArgumentError`。

殼側鍵一律以 `AQUTTER_` 開頭；網頁專案自己的 env 鍵不得使用此前綴（避免與殼側鍵混淆）。

| 鍵 | 預設 | 說明 |
| :--- | :--- | :--- |
| `AQUTTER_UPDATE_BASE_URL` | （空） | 更新來源 host；空＝停用 |
| `AQUTTER_UPDATE_VERSION_PATH` | `version.json` | 版本端點路徑，可為 API 路由 |
| `AQUTTER_UPDATE_METHOD` | `GET` | 版本查詢的 method；bundle 下載一律 GET |
| `AQUTTER_UPDATE_API_KEY` | （空） | 空＝不帶鑑權 header |
| `AQUTTER_UPDATE_API_KEY_HEADER` | `X-Api-Key` | 設 `Authorization` + 值填 `Bearer <token>` 即為 Bearer |
| `AQUTTER_UPDATE_BUNDLE_AUTH` | `true` | zip 指向第三方 CDN 的 pre-signed URL 時設 `false` |
| `AQUTTER_UPDATE_REQUIRED` | `false` | `true`＝版本查詢必須成功才掛網頁，失敗進阻擋頁可重試；需搭配非空的 `AQUTTER_UPDATE_BASE_URL` |

> `AQUTTER_UPDATE_METHOD` / `AQUTTER_UPDATE_BUNDLE_AUTH` **嚴格解析**，無法辨識的值於啟動時直接拋
> `ArgumentError` 並落到錯誤畫面。刻意不做靜默 fallback——設定打錯若默默退回 GET，
> 症狀會是伺服器回 405，看起來像網路錯誤，遠比啟動即報錯難查。

`POST` 模式的 request body：

```json
{ "currentVersion": "260721173045", "platform": "android", "hostVersion": "1.0.0", "hostBuildNumber": 1 }
```

`currentVersion` 取自本地 `current/version.json`，首開或無版本標記時為 `null`，
伺服器應視為最舊；`platform` 為 `Platform.operatingSystem`，供伺服器做灰度或分眾；
`hostVersion` / `hostBuildNumber` 為殼的 versionName 與 build number（後者解析不出整數時為 `null`），
伺服器據此決定要不要回 `host.minBuildNumber` 強制更新殼。`GET` 模式不帶 body。

端點需提供：
- **版本回應**（兩種 method 的回應格式相同）：`{ "version": "260721173045", "url": "https://.../bundle-260721173045.zip", "sha256": "<hex>", "size": 1234567, "host": { … } }`（`size` 與 `host` 選填，見上方）
  - 版本**必須可排序**且與種子同格式（`YYMMDDHHmmss`，UTC）——比對是大於判斷，
    格式不一致會讓字典序失去意義。建議直接沿用 `aqutter seed` 產出的版本值。
- `bundle.zip`：網頁框架的靜態輸出內容（如 Nuxt 的 `.output/public`、Vite 的 `dist`；根含 `index.html`）。可直接沿用 `aqutter seed` 打包出的 zip 結構。

> `version.json` **必須**一併打包進 bundle 根，解壓後的 `current/version.json` 才會反映當前版本供下次比對。
> `aqutter seed` 打包的 zip 已含此檔，沿用其結構即可。
> 缺少此檔會讓 `current/` 被視為「無版本標記」，每次啟動都判定為需更新。

## 種子保底的移除（未來轉純遠端）

種子僅為首開離線保底。轉純遠端時：
1. 刪 `lib/server/seed_bootstrapper.dart` 與 `pubspec.yaml` 的 `assets/seed/`。
2. `bundle_manager.ensureCurrent()` 移除 `_seed.ensureSeed(...)` 呼叫；改為 `current/` 為空時強制先 `checkForUpdate()`（首開連網下載整包，並加離線提示 UI）。

server / 熱更新主流程不受影響。
