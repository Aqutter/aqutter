# CLI 指令與旗標

指令為 `aqutter`（套件 `@aqutter/aqutter-cli`）。除 `init`、`plugin create` 外，都從目前目錄往上找 `aqutter.config.json` 決定專案根。

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

同時啟動網頁 dev server 與 `flutter run`。

`target`：省略 / `pick`（互動選單，全平台）、`ios`、`android`（互動，限該平台範圍）、`macos`、`windows`、`linux`、`ios-device`、`<flutter device id>`。

| 旗標 | 說明 |
|---|---|
| `--x-env=<name>` | 預設組：展開為 `--env=<envDir>/.env.<name>` 與 `--flavor=<name>`（env 檔必須存在；flavor 沒建則略過並印一行）。明給的旗標優先 |
| `--env=<path>` | env 檔路徑（相對專案根，預設 `defaultDevEnv`）。找不到即中止，不退回任何預設 |
| `--flavor=<name>` | Flutter flavor |
| `--port=<n>` | dev server 埠（預設 `defaultPort`）。同時用於 `AQUTTER_DEV_URL`、adb reverse、dev server 與 `DEV_PORT` |

連線規則：桌面與 iOS 模擬器用 `http://localhost:<port>`；Android 以 `adb reverse` 後用 localhost；iOS 實機用開發機區網 IP（並設 `DEV_HOST`）。Android 目標另加 `--enable-hcpp`。

互動選單列出執行中的裝置、可開機的 iOS 模擬器（`xcrun simctl`）與 Android 模擬器（`flutter emulators`），選到未開機者會自動開機。

## aqutter seed

產生靜態網頁並打包成種子網頁包。

| 旗標 | 說明 |
|---|---|
| `--env=<path>` | env 檔（預設 `defaultDevEnv`），找不到即中止 |

步驟：清空 `web.cleanDirs` → 框架產生靜態網頁 → 打包為 `<appDir>/assets/seed/web-bundle.zip`（附 `seed-version.json`）→ 交付一份 `artifacts/web_<env>_<版本>.zip`（OTA 上傳用）。種子內若出現字型檔（`.woff2` / `.woff` / `.ttf` / `.otf`）會中止——字型由殼提供。

## aqutter build [platform[,platform…]]

打包 App。`platform`：`apk` `aab` `ios` `ipa` `macos` `windows` `linux`；多平台以逗號分隔（空白分隔亦可），依序建置，種子只產一次，某平台失敗續跑其餘、最後彙整並以非 0 退出。未知平台名一律中止。省略時進入互動選單（平台可多選；env / flavor / 簽章設定由掃描偵測）。

| 旗標 | 說明 |
|---|---|
| `--x-env=<name>` | 預設組：展開為 `--env=<envDir>/.env.<name>`、`--flavor=<name>`、`--signing=signing/signing.<name>.json`。env 必須存在；flavor 沒建、簽章檔不存在則略過該項 |
| `--env=<path>` | env 檔（預設 `defaultProdEnv`） |
| `--flavor=<name>` | Flutter flavor |
| `--signing=<path>` | 簽章設定檔，相對 `<appDir>/`（範本 `signing/signing.example.json`）。缺某平台區塊該平台不簽並警告；可簽的平台全缺才中止 |
| `--export-options=<path>` | 自備 ipa 匯出設定，相對 `<appDir>/` |

交付到 `artifacts/`：`<artifactName>_<env>[_<flavor>]_<version>.<ext>`（單檔複製、目錄型產物壓 zip）。簽章：`ipa` 走 `flutter build ios --no-codesign` → `xcodebuild archive/export`；`macos` 打包後 `codesign`（可選公證）；`windows` 打包後 `signtool`，憑證密碼只從環境變數 `WIN_PFX_PASSWORD` 讀。細節見 [建置、flavor 與簽章](build-and-signing.md)。

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

## 行程環境變數

| 變數 | 用於 | 說明 |
|---|---|---|
| `WIN_PFX_PASSWORD` | `build windows` | Windows 簽章憑證密碼（簽章設定檔用 `pfx` 時必填）；不會印在命令列 |
| `JAVA_HOME` | `android gen-jks` | 尋找 `keytool` |
| `HOME` | `dev` | 尋找 Android SDK 的 `adb` |
| `DEV_PORT` / `DEV_HOST` | 由 `dev` 設給 dev server | 專案設定（CSP、HMR）讀取；iOS 實機時 `DEV_HOST` 為區網 IP |
