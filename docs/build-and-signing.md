# 多環境、Flavor 與手動簽章

打包/開發有**兩個獨立維度**，可自由組合：

| 維度 | 控制什麼 | 怎麼切 |
| :-- | :-- | :-- |
| **env** | 執行期設定值（API base、更新來源、feature flag…） | `--env=<env 檔路徑>`（`--dotenv` / `--dart-define-from-file`） |
| **flavor** | 建置身分（bundle id、顯示名、簽章 team / 描述檔） | Flutter `--flavor`（iOS scheme + Android productFlavor） |

`aqutter dev` / `aqutter build` 參數**慣例一致**：

- **positional** = target（dev：`macos`/`ios`/`android`/`<device id>`）或 platform（build：`apk`/`aab`/`ios`/`ipa`/`macos`）
- **`--env=<env 檔路徑>`** = 環境。值即相對網頁專案根目錄的檔案路徑（如 `.env/.env.uat`），dev / seed 預設 `.env/.env.dev`、build 預設 `.env/.env.prod`。**找不到即中止，不做任何退回。**
- **`--flavor=<name>`** = Flutter flavor；build 另有 **`--signing=<path>`**（手動簽章，見 §3）與 **`--export-options=<path>`**（自備 ipa 匯出設定）

env 一律用 `--env=`（不用位置參數），dev 與 build 完全一致。

## 1. env（單一資料源）

`--env=` 指定的那一份 env 檔同時給網頁端（由所選 web adapter 載入，例如 Nuxt 的 `--dotenv=`）與 Flutter（`--dart-define-from-file`，原生支援 .env 格式）。連線用的 `AQUTTER_DEV_URL` 不寫在檔裡，由 `aqutter dev` 依平台注入並以 CLI `--dart-define` 覆蓋（`--dart-define` > `--dart-define-from-file`）。

- 一律放網頁專案根目錄的 `.env/` 子目錄：`.env/.env.example`（範本）、`.env/.env.dev`（納入 git）、`.env/.env.prod` / `.env/.env.uat`（git 忽略）。
- 找不到 `--env=` 指定的檔案**不會退回 dev**，直接報錯。
- **`--x-env=<name>`**（dev / build）：一個旗標展開為 `--env=.env/.env.<name>`、`--flavor=<name>`、`--signing=signing/signing.<name>.json`（dev 無 signing）。env 檔**必須存在**；flavor 沒建（依 §2 的偵測）、簽章檔不存在則略過該項並印一行。明給的 `--env` / `--flavor` / `--signing` 覆蓋對應展開項。`aqutter dev --x-env=uat` / `aqutter build --x-env=uat <platform>` 即 uat 一條龍；也可在自己的 `package.json` scripts 定義捷徑包裝。

## 2. flavor（Flutter 的多環境身分）

> **重點：Flutter 的 `--flavor` 對應「Scheme 名」，並依命名慣例找 `<Mode>-<flavor>` 的 Configuration。兩者都要。**

`flutter build ipa --flavor uat` 會：
1. 以 flavor 名找 **scheme**（實際 `xcodebuild -scheme uat`）→ 必須有名為 `uat` 的 scheme。
2. 再找 build **configuration** `Debug-uat` / `Release-uat` / `Profile-uat`（`<Mode>-<flavor>`）。

| | Scheme | Configuration | 換環境靠 |
| :-- | :-- | :-- | :-- |
| **Flutter** | 每 flavor 一個（`uat`/`prod`） | **mode × flavor**（`Release-uat`…） | **切 flavor（= scheme）**，Flutter 再用命名慣例找 config |

環境做進 flavor（scheme），但仍要建出 `<Mode>-<flavor>` 這批 config 並和 scheme 串好——`aqutter flavor add` 會代勞（見下）。

### 建立 flavor：`aqutter flavor add [<name>]`

此 CLI 指令（零額外依賴、不用 Ruby / CocoaPods）互動問完 flavor 名、顯示名、Apple bundle id、Android applicationId 後，一次寫進 Android / iOS / macOS；Windows / Linux 自 Flutter 3.47 起內建 flavor（產物隔離到 `<arch>/<flavor>/`），不需設定。已存在同名 flavor 一律中止，不覆寫、不半套。

```bash
aqutter flavor add uat        # 名稱可省略，改為問答
```

指令實際做的事（等同在 Xcode / Gradle 手動操作）：

| 平台 | 變更 |
| :-- | :-- |
| **Android** `app/build.gradle.kts` | 插入 `flavorDimensions += "env"` 與 `productFlavors { create("<name>") { dimension / applicationId / resValue("string","app_name",…) } }`（已有 `productFlavors` 就只追加）；一次性打開 `buildFeatures { resValues = true }`（AGP 9 預設關閉，否則設定階段即報 *custom resource values, but the feature is disabled*）。 |
| **Android** `AndroidManifest.xml` | 一次性：`android:label` 改為 `@string/app_name`，原字串移到 `defaultConfig.resValue` 當預設——flavor 的 `resValue` 覆蓋 `defaultConfig` 是 AGP 明定優先序；放進 `res/values/strings.xml` 反而會與 flavor 的 `resValue` 撞成 Duplicate resources。 |
| **iOS / macOS** `project.pbxproj` | 純文字複製 `Debug` / `Release` / `Profile` 三個 `XCBuildConfiguration` 為 `<Mode>-<name>`（新 24 位 hex ID、`baseConfigurationReference` 原樣保留——Flutter 靠 `Debug/Release.xcconfig` 引入 `Generated.xcconfig`），追加到每個 `XCConfigurationList`；只有 `PBXNativeTarget "Runner"` 那組副本覆寫 `PRODUCT_BUNDLE_IDENTIFIER` 與 `APP_DISPLAY_NAME`（config 層 build setting 優先於 xcconfig，macOS 的 `AppInfo.xcconfig` 不必改）。 |
| **iOS / macOS** `xcshareddata/xcschemes/<name>.xcscheme` | 以 `Runner.xcscheme` 為模板，`buildConfiguration` 全改指向 `<Mode>-<name>`。 |
| **iOS / macOS** `Runner/Info.plist` | 一次性：`CFBundleDisplayName` 改為 `$(APP_DISPLAY_NAME)`，原字串寫進 Runner 既有三個 configuration（macOS 範本沒有這個鍵，補上）。 |

**不寫任何簽章欄位**：iOS / macOS 的 manual 簽章由 `--signing=`（§3）在 archive / export 階段以 build settings 帶入，flavor 只負責身分；Android release 的 `signingConfig` 仍待接線（§4）。

驗證：`xcodebuild -list -project <platform>/Runner.xcodeproj` 應列出 `<name>` scheme 與六個新 configuration；`flutter build macos --debug --flavor <name>` 產物 `Info.plist` 的 `CFBundleIdentifier` / `CFBundleDisplayName` 即為新值；Gradle `./gradlew tasks --all` 出現 `assemble<Name>` / `bundle<Name>`。

## 3. 手動簽章（`--signing=<path>`；iOS / macOS / Windows）

Flutter 本身沒有 Xcode 手動簽章（team / 憑證 / 描述檔 / export method）的旗標，Aqutter 改由 **簽章設定檔** 驅動，`aqutter build` 依平台接手簽章；未給 `--signing` 時行為與過去完全相同（走 Xcode 專案的 Automatic 簽章、桌面產物不簽）。

### 設定檔（`<appDir>/signing/signing.<name>.json`，`appDir` 預設 `aqutter/`）

只放**身分**資訊、可進 git；範本 `signing/signing.example.json`。`<name>` 與 env 檔的 `<name>` 對應，`--x-env=<name>` 據此自動帶入；互動選單只列 `signing.*.json` 且排除 `*.example.*`。只讀取與本次平台對應的區塊：缺檔、壞 JSON、有區塊但缺欄位一律中止並指出缺什麼；**區塊缺席的平台不簽並警告**（同一台 Mac 上 ipa 企業簽而 macos 不簽是合法情境），但選到的可簽平台**全部**缺席仍中止——那是給錯檔，不是不想簽。

```json
{
  "ios":     { "method": "enterprise", "teamId": "ABCDE12345", "certificate": "Apple Distribution",
               "profile": "Profile_MyApp_Enterprise", "bundleId": "<orgId>.<appName>" },
  "macos":   { "identity": "Developer ID Application: Example Inc (ABCDE12345)", "notaryProfile": "my-notary" },
  "windows": { "pfx": "signing/uat.pfx", "timestampUrl": "http://timestamp.digicert.com" }
}
```

**秘密不寫進任何檔案**，只從 process env 讀：

| 秘密 | 來源 |
| :-- | :-- |
| Windows pfx 密碼 | `WIN_PFX_PASSWORD` env var（log 內以 `***` 遮蔽） |
| macOS 公證帳號 | 事先 `xcrun notarytool store-credentials <notaryProfile>` 存入 keychain，設定檔只寫 profile 名 |
| iOS 憑證／描述檔 | 匯入 keychain／`~/Library/MobileDevice/Provisioning Profiles/` 屬環境準備（本機用 Xcode 登入；CI 以 `security import` 匯入），不在 `aqutter build` 範圍 |

憑證本體（`*.pfx` / `*.p12` / `*.mobileprovision`）已列入 `.gitignore`。

### 各平台流程

| 平台 | `aqutter build` 做的事 |
| :-- | :-- |
| **ipa** | `flutter build ios --release --no-codesign`（寫出含 dart-define 的 `Generated.xcconfig` 並完成 Flutter 端組譯）→ `xcodebuild archive`（`CODE_SIGN_STYLE=Manual` / `DEVELOPMENT_TEAM` / `PROVISIONING_PROFILE_SPECIFIER` / `CODE_SIGN_IDENTITY` 以 build settings 帶入，**不改 pbxproj、不依賴 flavor**）→ 由 `ios` 區塊自動產生 `build/ios/ExportOptions.plist`→ `xcodebuild -exportArchive` 到 `build/ios/ipa/`。另給 `--export-options=` 時以該檔為準、不自動產生。有 `--flavor` 時 scheme 為 flavor 名、configuration 為 `Release-<flavor>`。 |
| **macos** | `flutter build macos` 後 `codesign --force --deep --options runtime --timestamp --entitlements macos/Runner/Release.entitlements --sign <identity>`；有 `notaryProfile` 才 `ditto` 壓 zip → `xcrun notarytool submit --wait` → `xcrun stapler staple`。交付的 zip 含 staple 票證。 |
| **windows** | `flutter build windows` 後對 Release 目錄的每個 `.exe` 執行 `signtool sign /fd SHA256 /td SHA256 /tr <timestampUrl>`，憑證 `pfx`（`/f … /p $WIN_PFX_PASSWORD`）或 `thumbprint`（`/sha1`，憑證存放區）二擇一。`signtool` 隨 Windows SDK 安裝、需在 PATH。 |
| ios（`.app`）/ apk / aab / linux | 不套用，給了 `--signing` 只警告（apk / aab 走 Gradle 自己的簽章設定，見 §4）。 |

### 用法

```bash
aqutter build --x-env=uat ipa                  # signing/signing.uat.json 存在即自動帶入
aqutter build --x-env=uat macos
WIN_PFX_PASSWORD=… aqutter build --x-env=uat windows
aqutter build --x-env=uat ipa,macos            # 設定檔只有 ios 區塊 → ipa 企業簽、macos 不簽（警告）
aqutter build --env=.env/.env.uat --signing=signing/signing.prod.json ipa   # 不走 x-env 時明給路徑
```

> **前提**：企業描述檔綁定 app id。企業簽需有「對應本專案 bundle id（`<orgId>.<appName>` 或 flavor 指定的 id）的 enterprise provisioning profile」（於企業 Apple 帳號建立），並把 bundle id 與描述檔名填入設定檔的 `ios` 區塊。

## 4. Android release keystore（`aqutter android gen-jks`）

release APK / AAB 需要自己的簽章金鑰。以互動指令產生，免手打 `keytool -genkeypair` 長指令，Windows / macOS / Linux 同一份（只需 Node 與 JDK 的 `keytool`；PATH 找不到時會退而讀 `JAVA_HOME`）：

```bash
aqutter android gen-jks
```

依序詢問：keystore 檔名（預設 `app-release.jks`）→ alias（預設 `app`）→ 密碼兩次（遮罩、至少 6 字元，store 與 key 共用）→ 有效年數（預設 99）→ 憑證主體（擁有者名稱 / 部門 / 公司名稱必填；城市預設 `Taipei`、國家代碼預設 `TW`）。

產出到 `<appDir>/android/`：
- `<name>.jks` — keystore 本體（`-keyalg RSA -keysize 2048 -storetype JKS`；keytool 印出建議改 PKCS12 的警告屬正常）。
- `key.properties` — gradle 簽章設定要讀的四個鍵：`storePassword` / `keyPassword` / `keyAlias` / `storeFile`。`storeFile` 寫成 `../<name>.jks`，因為 `app/build.gradle.kts` 的 `file()` 以 app 模組（`android/app/`）為基準。

兩個檔案都已被 `<appDir>/android/.gitignore` 忽略；已存在時會先詢問是否覆寫，拒絕即中止。密碼經環境變數交給 keytool（`-storepass:env` / `-keypass:env`），不會出現在命令列與 shell history。**keystore 與密碼請自行備份——遺失即無法再更新已上架的 App。**

> 目前 `app/build.gradle.kts` 的 release 仍用 debug 簽章（`signingConfig = signingConfigs.getByName("debug")`），讀取 `key.properties` 接上 release `signingConfig` 為另一步，尚未納入。

## 5. 範例指令（env × flavor）

```bash
aqutter dev --x-env=uat            # env=uat，flavor uat 有建就帶（可再接 target：aqutter dev --x-env=uat android）
aqutter build --x-env=uat ipa      # env=uat，flavor / signing 有就帶；平台接在後面
aqutter build --x-env=uat --flavor=prod apk   # 明給的旗標覆蓋 x-env 展開的那一項
```

想要更短的捷徑，可在自己的 `package.json` scripts 定義（如 `"build:uat:ipa": "aqutter build --x-env=uat ipa"`），這些捷徑不由 Aqutter 提供。

自訂組合：`aqutter dev <target> --env=<env 檔路徑> --flavor=<name>`、`aqutter build <platform> --env=<env 檔路徑> --flavor=<name> --export-options=<path>`。
