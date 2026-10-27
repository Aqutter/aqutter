# CLI 指令與旗標

指令為 `aqutter`（套件 `@aqutter/aqutter-cli`）。CLI 位於獨立 repo [`Aqutter/aqutter-cli`](https://github.com/Aqutter/aqutter-cli)，本文件對應 CLI `0.0.0`；指令的實際行為以該 repo 的 `aqutter --help` 為準。除 `init`、`plugin create` 外，都從目前目錄往上找 `aqutter.config.json` 決定專案根。

旗標一律用 `--key=value`（值必須以 `=` 綁定；`--env x` 會把 `x` 當位置參數）。旗標放在位置參數前或後皆可。

## aqutter init

在既有網頁專案加入 Aqutter。

| 旗標 | 預設 | 說明 |
|---|---|---|
| `--name=<snake_case>` | 由 package.json 的 name 推導 | Dart 套件名 |
| `--org=<com.example>` | `com.example` | 反向網域；成為 Android namespace 與 Apple bundle id 的前綴 |
| `--display-name=<名稱>` | 由 name 推導 | 桌面標題與行動裝置顯示名 |
| `--framework=<nuxt\|vite\|next\|custom>` | 自動偵測，偵測不到為 `vite` | 網頁框架 |
| `--app-dir=<dir>` | `aqutter` | Flutter App 目錄 |
| `--shell-path=<殼目錄>` | — | 把殼依賴改指向本機路徑（開發殼本身時用） |
| `--shell-ref=<tag>` | CLI 版本 | 殼的 git tag |
| `--force` | — | 覆寫已存在的檔案與設定 |

## aqutter dev [target]

先啟動網頁 dev server，等它回應（任一回應非 5xx，最長 180 秒）後才啟動 `flutter run`，避免 App 先起來而拿到 dev server 還在編譯時的 5xx。dev 模式下殼遇到載入錯誤或 5xx 也會自動重試（每秒一次、最多 60 次，期間維持啟動畫面），用盡才顯示「啟動失敗」。

`target`：省略 / `pick`（互動選單，全平台）、`ios`、`android`（互動，限該平台範圍）、`macos`、`windows`、`linux`、`ios-device`、`<flutter device id>`。

| 旗標 | 說明 |
|---|---|
| `-e <環境>`、`--env=<環境>` | 環境：設定檔 `environments` 裡的**名稱**，或 env 檔路徑（相對專案根，預設 `defaultDevEnv`）。名稱會帶入該環境的 env 檔、flavor、網頁指令覆蓋；找不到即中止，不退回任何預設。見 [環境](config.md#環境environments) |
| `--x-env=<name>` | 預設組：名稱在 `environments` 裡就以設定檔為準；否則沿用慣例，展開為 `--env=<envDir>/.env.<name>` 與 `--flavor=<name>`（env 檔必須存在；flavor 沒建則略過並印一行）。明給的旗標優先 |
| `--flavor=<name>` | Flutter flavor |
| `--port=<n>` | dev server 埠（預設 `defaultPort`）。同時用於 `AQUTTER_DEV_URL`、adb reverse、dev server 與 `DEV_PORT` |

連線規則：桌面與 iOS 模擬器用 `http://localhost:<port>`；Android 以 `adb reverse` 後用 localhost；iOS 實機用開發機區網 IP（並設 `DEV_HOST`）。Android 目標另加 `--enable-hcpp`。

互動選單列出執行中的裝置、可開機的 iOS 模擬器（`xcrun simctl`）與 Android 模擬器（`flutter emulators`），選到未開機者會自動開機。

## aqutter seed

產生靜態網頁並打包成種子網頁包。

| 旗標 | 說明 |
|---|---|
| `-e <環境>`、`--env=<環境>` | 環境名或 env 檔路徑（預設 `defaultDevEnv`），找不到即中止；環境名會帶入該環境專屬的網頁指令 |

步驟：清空 `web.cleanDirs` → 框架產生靜態網頁 → 打包為 `<appDir>/assets/seed/web-bundle.zip`（附 `seed-version.json`）→ 交付一份 `artifacts/web_<env>_<版本>.zip`（OTA 上傳用）。種子內若出現字型檔（`.woff2` / `.woff` / `.ttf` / `.otf`）會中止——字型由殼提供。

## aqutter build [platform[,platform…]]

打包 App。`platform`：`apk` `aab` `ios` `ipa` `macos` `windows` `linux`；多平台以逗號分隔（空白分隔亦可），依序建置，種子只產一次，某平台失敗續跑其餘、最後彙整並以非 0 退出。未知平台名一律中止。省略時進入互動選單（平台可多選；env / flavor / 簽章設定由掃描偵測）。

| 旗標 | 說明 |
|---|---|
| `-e <環境>`、`--env=<環境>` | 環境名或 env 檔路徑（預設 `defaultProdEnv`）。環境名會帶入該環境設定的 env 檔、flavor、簽章與網頁指令覆蓋；旗標優先。見 [環境](config.md#環境environments) |
| `--x-env=<name>` | 預設組：名稱在 `environments` 裡就以設定檔為準；否則沿用慣例，展開為 `--env=<envDir>/.env.<name>`、`--flavor=<name>`、`--signing=signing/signing.<name>.json`。env 必須存在；flavor 沒建、簽章檔不存在則略過該項 |
| `--flavor=<name>` | Flutter flavor |
| `--signing=<path>` | 簽章設定檔，相對 `<appDir>/`（範本 `signing/signing.example.json`）。缺某平台區塊該平台不簽並警告；可簽的平台全缺才中止 |
| `--export-options=<path>` | 自備 ipa 匯出設定，相對 `<appDir>/` |

交付到 `artifacts/`：`<artifactName>_<env>[_<flavor>]_<version>.<ext>`（單檔複製、目錄型產物壓 zip）。簽章：`ipa` 走 `flutter build ios --no-codesign` → `xcodebuild archive/export`；`macos` 打包後 `codesign`（可選公證）；`windows` 打包後 `signtool`，憑證密碼只從環境變數 `WIN_PFX_PASSWORD` 讀。細節見 [建置、flavor 與簽章](build-and-signing.md)。

## aqutter env

管理設定檔裡的命名環境，見 [環境](config.md#環境environments)。

| 指令 | 說明 |
|---|---|
| `env add <名稱> [--flavor=<名>] [--signing=<路徑>] [--env-file=<路徑>] [--from=<環境名或 env 檔>]` | 新增環境：寫進 `aqutter.config.json`，並建立它的 env 檔（複製 `--from`，預設 `<envDir>/.env.example`）。同名環境已存在即中止、env 檔已存在則沿用，都不覆寫 |
| `env add … --dev-command=<指令> --build-command=<指令> [--prepare-command=<指令>] [--output-dir=<目錄>]` | 同時寫入這個環境專屬的網頁指令覆蓋 |
| `env list` | 列出已設定的環境（env 檔、flavor、簽章、網頁覆蓋的欄位） |
| `env remove <名稱>` | 只移除設定檔裡的環境；env 檔、flavor、簽章檔都保留 |

## aqutter flavor add [<name>]

互動式建立 flavor，一次寫進 Android、iOS、macOS 三個原生專案（Windows / Linux 自 Flutter 3.47 起內建 flavor）。同名 flavor 已存在即中止，不覆寫；其他一次性接線冪等。不寫任何簽章欄位，簽章由 `build --signing` 帶入。

## aqutter android gen-jks

互動式產生 Android release 簽章 keystore（呼叫 JDK 的 `keytool`），並寫出 gradle 要讀的 `key.properties`，產物位於 `<appDir>/android/`，皆已被該目錄的 `.gitignore` 忽略。密碼經環境變數交給 keytool，不出現在命令列。

## aqutter plugin

| 指令 | 說明 |
|---|---|
| `plugin create <id> [--npm-name=<名>] [--dir=<目錄>] [--shell-ref=<tag>] [--shell-path=<殼目錄>]` | 由範本建立 plugin 專案 |
| `plugin add <來源>` | 以套件管理器安裝（套件名、`github:owner/repo`、`file:路徑`），登記並同步 pubspec 與註冊清單；`--no-install` 只登記 |
| `plugin remove <id>` | 移除 |
| `plugin sync` | 依 `aqutter.config.json` 重寫 pubspec 與 `lib/aqutter_plugins.dart` |
| `plugin list` | 列出已安裝 plugin |

見 [Plugin 開發](plugins.md)。

## aqutter doctor

唯讀檢查專案與[發佈清單](releases.md)（release manifest）所描述的框架版本是否一致，並對每個不一致的項目指出修法。框架版本取自清單的 `stable` 頻道；Flutter 版本、`environment` 約束、殼 ref 都以該版本的清單內容為準。

| 檢查 | 說明 |
|---|---|
| Flutter 版本 | 本機 `flutter` 低於框架要求的下限為**錯誤**；高於基準版本（框架尚未驗證）為警告，不阻擋；等於基準版本通過。pubspec 沒有設上限，所以較新的 Flutter 不會被 pub 擋下，由這裡提醒 |
| pubspec `environment` | `sdk` / `flutter` 約束是否與框架一致 |
| 殼 ref | `<appDir>/pubspec.yaml` 的 `aqutter` git ref 是否等於清單記載的 commit；殼依賴是本機路徑時略過 |
| `.fvmrc`（選配） | 只在 `<appDir>/.fvmrc` 已存在時才檢查版本是否為框架基準；沒有這個檔案不會有任何提示（框架不要求使用 FVM） |
| npm 依賴 | `package.json` 內以 github 指定的 `@aqutter/aqutter`、`@aqutter/aqutter-cli` ref |
| lock | `pubspec.lock` 鎖定的 commit 是否落後遠端 ref（需連網；開發階段 tag 會隨 `main` 移動，lock 不會自動跟上） |

| 旗標 | 說明 |
|---|---|
| `--offline` | 不連網：清單只用本機快取，再退回 CLI 內建快照；同時略過 lock 與遠端的比對 |
| `--refresh` | 略過 24 小時的快取有效期，直接連網取得清單並更新本機快取（與 `--offline` 互斥） |

結束碼：有**錯誤**才為 1；只有警告為 0。

## aqutter upgrade

把專案對齊到清單所描述的框架版本（預設 `stable` 頻道）。

| 旗標 | 說明 |
|---|---|
| `--to=<版本>` | 指定框架版本；已撤回（`yanked`）的版本會被拒絕 |
| `--dry-run` | 只列出會改什麼，不寫檔、不執行 flutter |
| `--skip-pub` | 只改檔案，不執行 `flutter pub upgrade` |
| `--offline` | 不連網，清單只用本機快取與內建快照 |
| `--refresh` | 略過 24 小時的快取有效期，直接連網取得清單（與 `--offline` 互斥） |
| `--allow-downgrade` | 目標比現況舊時仍照做；預設拒絕（見下） |

會改的（只改需要改的那一行，保留原有格式）：

- `<appDir>/pubspec.yaml`：`environment.sdk`、`environment.flutter`，以及殼依賴的 git `ref`（本機路徑依賴不動）。
- `<appDir>/.fvmrc`：只在專案已有這個檔案時才更新 Flutter 版本（不會替沒有的專案建立；內容不是合法 JSON 時略過並提示，不覆寫）。
- `package.json`：`@aqutter/aqutter` 若是 `github:Aqutter/aqutter-js#…` 形態，改為清單的 client 安裝字串（其他寫法視為使用者自管，不動）；`@aqutter/aqutter-cli` 若仍是舊的 `…aqutter#…&path:/cli` 語法，改為 `github:Aqutter/aqutter-cli#<版本>`。

接著在 `<appDir>` 執行 `flutter pub upgrade aqutter aqutter_core`，讓 `pubspec.lock` 跟上。

**不會改**：`init` 當初展開的原生檔案（`android/`、`ios/`、`windows/` 等）與 `lib/`——它們是專案自己的。

### 降級保護

清單來自過期的快取時，`upgrade` 可能拿到**比專案現況舊**的版本。為了避免無聲降級，下列任一項目標低於現況時，`upgrade` 預設**拒絕**（不寫檔、不執行 flutter、結束碼 1；`--dry-run` 也一樣）：

| 比較項目 | 說明 |
|---|---|
| `pubspec.yaml` 的 `environment.flutter` 下限 | 例如 `>=3.47.8` → `>=3.47.4` |
| `pubspec.yaml` 的 `environment.sdk` 下限 | 例如 `>=3.13.7` → `>=3.13.0` |
| `.fvmrc` 的 `flutter` | 只在檔案存在時比較 |

訊息會列出每個降級項（現況 → 目標），並提示：常見原因是清單來自過期快取，先加 `--refresh` 重新取得；確定要降級才加 `--allow-downgrade`（此時照做，並先印一行警告）。現況或目標讀不出下限（例如 `^` 範圍）的項目略過；相同或變高不算降級。

升級流程：先把 `@aqutter/aqutter-cli` 升到新版並重新安裝（若清單的 `cli.min` 高於目前 CLI，指令會拒絕並提示），再執行 `aqutter upgrade`，最後 `aqutter doctor` 確認。升級後若 `package.json` 有變動，指令會提示重新安裝依賴的指令。

## 行程環境變數

| 變數 | 用於 | 說明 |
|---|---|---|
| `WIN_PFX_PASSWORD` | `build windows` | Windows 簽章憑證密碼（簽章設定檔用 `pfx` 時必填）；不會印在命令列 |
| `JAVA_HOME` | `android gen-jks` | 尋找 `keytool` |
| `HOME` | `dev` | 尋找 Android SDK 的 `adb` |
| `DEV_PORT` / `DEV_HOST` | 由 `dev` 設給 dev server | 專案設定（CSP、HMR）讀取；iOS 實機時 `DEV_HOST` 為區網 IP |

## 清單來源

`init`、`plugin create`、`doctor`、`upgrade` 會讀發佈清單：預設從 `https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json` 取得並快取 24 小時，逾時 15 秒；失敗時依序退回舊快取與 CLI 內建快照。加 `--refresh` 可略過快取有效期強制連網（失敗時行為相同）。

輸出的 `manifest 來源` 會標出清單從哪來；來自快取時還會顯示它**多舊**（例如「約 3 小時前取得；--refresh 可強制重新取得」）。開發階段清單一天內可能更新多次，看到來源是快取時，先想一想要不要 `--refresh`。可用環境變數 `AQUTTER_MANIFEST_URL` 或 `aqutter.config.json` 的 `manifest.url` 改成其他 https 網址。
