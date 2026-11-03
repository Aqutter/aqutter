# Plugin 開發

Plugin 讓第三方擴充 Aqutter：同一個 repo 同時是 **npm 套件**（網頁端 API 與型別）與 **Dart 套件**（Flutter 端實作）。Plugin 可以：

- 對網頁暴露方法（網頁 `callPlugin(id, method, payload)` → Dart handler）
- 主動對網頁派送事件（Dart `context.emit` → 網頁 `onPluginEvent`）
- 在 WebView 之上掛原生 Flutter UI，或在之下掛被網頁鏡像的內容（[native view 鏡像](nativeview.md)）
- 相依任何既有的 Flutter plugin（例如 `battery_plus`），原生部分由 Flutter 工具鏈照常整合

## 建立

```bash
aqutter plugin create haptics
```

產生 `aqutter-plugin-haptics/`：

| 路徑 | 用途 |
|---|---|
| `aqutter-plugin.json` | 描述檔：`id` 與 Dart 端類別 |
| `src/index.ts` | 網頁端 API；把契約併入 `AqutterPluginRegistry` |
| `lib/` | Dart：實作 `AqutterPlugin` 的類別 |
| `pubspec.yaml` / `package.json` | 兩端的套件宣告 |

## 命名規則

| 項目 | 規則 |
|---|---|
| plugin id | `^[a-z][a-z0-9-]*$`，不含 `.` |
| handler 名稱 | `<id>.<method>` |
| 事件頻道 | `<id>.<event>` |

兩端各自用同一條規則組名：Dart `aqutterPluginHandlerName` / `aqutterPluginEventChannel`，TS `pluginHandlerName` / `pluginEventChannel`。

殼自己的剪貼簿、分享、本機通知、深層連結也是 plugin（內建，不必傳入 `plugins:`），所以 `clipboard`、`share`、`notification`、`deeplink` 是保留的 id：自己的 plugin 取這些名字會在組裝時丟 `ArgumentError`（重複的 plugin id）。它們的用法見[內建原生功能](native-features.md)。

## Dart 端

```dart
class HapticsPlugin extends AqutterPlugin {
  @override
  String get id => 'haptics';

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'impact': (payload) async {
          await HapticFeedback.mediumImpact();
          return {'ok': true};
        },
      };
}
```

| 成員 | 說明 |
|---|---|
| `id` | 必填 |
| `supportedPlatforms` | 選填；`Set<TargetPlatform>?`，`null`（預設）代表所有平台。見下方「宣告支援的平台」 |
| `handlers` | 暴露給網頁的方法；回傳值須可 JSON 序列化，酬載與回傳值可直接含 `Uint8List`（見下方「二進位」） |
| `attach(context)` | 殼就緒後呼叫一次；以 `context.emit(event, payload)` 派送事件 |
| `buildOverlay(context)` | 疊在 WebView 之上、啟動過場之下的 UI；需要吃觸控請自行限定範圍 |
| `buildUnderlay(context)` | 墊在 WebView 之下、被網頁蓋住但仍在 Flutter 渲染的內容（網頁載入前就掛上）；搭配 [native view 鏡像](nativeview.md) |
| `dispose()` | 殼結束時釋放資源 |

Plugin 的 handler 會列入 `platform_info` 的 `capabilities`，網頁以 `isPluginSupported(id, method)` 查詢（沒裝該 plugin 的 App 為 `false`）。

### 二進位

酬載與回傳值、事件內容可以直接放二進位，不需要 base64，也不需要另外選擇通道：

```dart
@override
Map<String, AqutterPluginHandler> get handlers => {
  'process': (payload) async {
    final input = payload['image'] as Uint8List;   // 網頁送來的 Uint8Array
    return {'result': await run(input)};           // 回傳 Uint8List 即可
  },
};
```

```ts
const { result } = await callPlugin('my-plugin', 'process', { image: new Uint8Array(bytes) })
// result 是 Uint8Array
```

- Dart 的 `Uint8List`（及其他 `TypedData`）與 JS 的 `ArrayBuffer`／`Uint8Array` 等，送出時自動處理；收到時一律是 `Uint8List`／`Uint8Array`。`$bin` 是酬載物件的保留鍵，使用者資料不得使用。
- 呼叫、回應與事件共用**同一條**本機連線（見 [通道效能](channel-performance.md)）。超過 64 MiB 的資料由框架自動分段送出、收到後組回，使用者不需處理；單次上限 512 MiB，超過以 `PAYLOAD_TOO_LARGE` 失敗。組回後整份資料仍在記憶體裡，這不是串流。
- 連線意外中斷時，已送出未回應的呼叫會以 `TRANSPORT_CLOSED` 失敗並自動重連；事件不補發，需要時用網頁端的 `onTransportState` 在重連後重新取得狀態。
- 網頁的 CSP 需允許 `connect-src ws://127.0.0.1:*`（所有 App 都需要，不只用鏡像者）。

### 宣告支援的平台

有些 plugin 只在部分平台有實作（例如地圖只有 iOS、Android 有原生版本）。覆寫 `supportedPlatforms` 即可宣告：

```dart
class MapsPlugin extends AqutterPlugin {
  @override
  String get id => 'maps';

  @override
  Set<TargetPlatform>? get supportedPlatforms => {TargetPlatform.android, TargetPlatform.iOS};
}
```

目前平台不在集合內時：

| 項目 | 行為 |
|---|---|
| handler | 仍註冊（呼叫不會是 handler not found），但**不列入** `capabilities`，所以 `isPluginSupported(id, method)` 回 `false` |
| 被呼叫時 | 殼**不執行**你的 handler，回傳 `{ aqutterError: { code: 'UNSUPPORTED_PLATFORM', message } }`；網頁端 `callPlugin` 把它轉成回傳 `undefined`（**不拋錯**，正式版才不會因為缺少某個平台的實作而壞掉；開發階段在 console 警告一次），不會卡住。回傳型別因此是 `Res \| undefined`，呼叫端必須處理 |
| `attach`、`buildUnderlay`、`buildOverlay` | 殼不呼叫 |
| `dispose` | 仍會呼叫，必須可安全呼叫 |

網頁用同步的 `isPluginSupported` 就能分支，不必再多設計一個 `isSupported` 方法往返一次：

```ts
if (isPluginSupported('maps', 'moveTo')) {
  // 原生實作
}
else {
  // 替代方案，例如純網頁的實作
}
```

#### 逐方法宣告平台

同一個 plugin 的各方法平台不同時（例如內建的 `clipboard`：文字全平台可用，圖片只有部分平台），覆寫 `supportedPlatformsFor(method)`；沒有覆寫的方法沿用 `supportedPlatforms`：

```dart
class ClipboardLikePlugin extends AqutterPlugin {
  @override
  String get id => 'clip';

  @override
  Set<TargetPlatform>? supportedPlatformsFor(String method) {
    return method == 'readImage' ? {TargetPlatform.android, TargetPlatform.iOS} : super.supportedPlatformsFor(method);
  }
}
```

不支援的方法行為和上表相同（仍註冊、不列入 `capabilities`、呼叫端收到 `undefined`），只影響那一個方法。`attach` 在 plugin 層或任一方法支援目前平台時呼叫。

`aqutterError` 是殼的保留欄位，plugin 自己的回傳不得使用這個名稱。

## 權限

權限一律問殼，plugin 不必自行相依 `permission_plus`。`attach` 收到的 `context` 提供：

```dart
final status = await context.checkPermission('camera');   // 不跳授權視窗
if (status != 'granted') {
  await context.requestPermission('camera');               // 必要時跳系統授權視窗
}
await context.openPermissionSettings();                    // 被永久拒絕後，引導使用者到系統設定
```

型別字串與狀態字串沿用網頁端 `PermissionType` / `PermissionStatus`（`camera`、`microphone`、`location`、`notifications`、`photos`、`contacts`、`calendar`、`bluetooth`、`storage`、`phone`、`sms`…；`granted`、`denied`、`permanentlyDenied`、`restricted`、`limited`、`prompt`），不認識的型別回 `denied`。網頁 bridge 與 plugin 走同一個實作，行為一致。

網頁 `getUserMedia` 等 WebView 授權由殼決定，不開放 plugin 各自回答：只放行殼自己供應的頁面，資源以 `AqutterConfig(webPermissions: {...})` 設定（預設相機與麥克風）。App 仍要在 `AndroidManifest.xml`／`Info.plist` 宣告對應權限。

## 相依其他 plugin

plugin A 要用 plugin B（例如地圖用定位）時，在 Dart 端經 `context.callPlugin` 呼叫，不要自己 new B 的類別——那不是殼註冊的實例，狀態不共用：

```dart
final result = await context.callPlugin('location', 'getCurrentPosition', {'accuracy': 'high'});
```

找不到 B（`PLUGIN_NOT_FOUND`）、B 沒有該方法（`HANDLER_NOT_FOUND`）、該方法不支援目前平台（`UNSUPPORTED_PLATFORM`）、B 的 handler 回傳錯誤資料時，都會拋 `AqutterRpcException`。**不要形成循環**（A 呼叫 B、B 又呼叫 A），殼不防護。

想讓 B 只供 A 使用、不讓網頁直接呼叫，B 覆寫 `internal`：

```dart
@override
bool get internal => true;
```

internal plugin 不對網頁註冊 handler、也不列入 `capabilities`，網頁呼叫它得到 `HANDLER_NOT_FOUND`（`callPlugin` 回 `undefined`）。A 在自己的方法裡包裝 B 的能力再暴露給網頁。

A 在 `aqutter-plugin.json` 用選填的 `requires` 宣告它需要哪些 plugin，鍵是 B 的 npm 套件名，值是版本範圍：

```json
{
  "schema": 1,
  "id": "map-with-location",
  "dart": { "package": "aqutter_plugin_map_with_location", "class": "MapWithLocationPlugin" },
  "requires": { "aqutter-plugin-location": "^0.0.0" }
}
```

| 規則 | 說明 |
|---|---|
| 連帶登記 | `aqutter plugin add A` 會一併安裝並登記 B；B 的來源取自 A 的 `package.json` 的 `dependencies`，所以 B 要同時列在那裡 |
| 版本範圍 | 支援 `^`、`~` 與精確版本。已安裝的 B 不滿足範圍時 `plugin add` 失敗，`aqutter doctor` 列為錯誤 |
| 單一版本 | 一個 App 每個 plugin 只能有一個版本；兩個 plugin 要求 B 的不相交範圍時沒有解 |
| 移除 | 仍有 plugin 的 `requires` 指向 B 時，`aqutter plugin remove B` 會拒絕 |

沒有 `requires` 的 plugin 行為完全不變。

## 宣告原生設定

plugin 需要使用者在原生專案補權限或 `Info.plist` 說明文字時，在 `aqutter-plugin.json` 用選填的 `native` 區塊宣告。沒有這個區塊的 plugin 行為完全不變。

```json
{
  "schema": 1,
  "id": "biometrics",
  "dart": { "package": "aqutter_plugin_biometrics", "class": "BiometricsPlugin" },
  "native": {
    "features": {
      "unlock": {
        "android": { "permissions": [{ "name": "android.permission.USE_BIOMETRIC" }] },
        "ios": { "infoPlist": { "NSFaceIDUsageDescription": "Use Face ID to unlock the app" } },
        "note": "Android 的 MainActivity 必須繼承 FlutterFragmentActivity"
      }
    }
  }
}
```

| 欄位 | 說明 |
|---|---|
| `native.features` | 必填（有 `native` 時）：功能名（`^[a-z][a-z0-9-]*$`）對應各自的需求；一個 plugin 可有多個功能 |
| `<feature>.android.permissions[]` | `{ name, maxSdkVersion? }`：要在 `AndroidManifest.xml` 有的 `uses-permission` |
| `<feature>.ios.infoPlist`、`<feature>.macos.infoPlist` | 要在 `Info.plist` 有的鍵；值是**建議文字**，使用者可以改，只檢查鍵存在且非空 |
| `<feature>.note` | 無法機器檢查的要求，只顯示給人看 |

未知的子欄位會被忽略，日後擴充不必升 `schema`。

使用者可以只選用部分功能：

```bash
aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/file-manager" --features sandbox   # 省略 --features＝全部功能
```

選擇記在 `aqutter.config.json` 該 plugin 項目的 `features`。CLI 只檢查所選功能的需求：

- `plugin add` 結束時印出還缺的設定與 `note`。
- `aqutter doctor` 把仍然缺的列為**警告**（建置不受影響，執行時才會出問題）。
- CLI **不會修改** `AndroidManifest.xml` 與 `Info.plist`；那是使用者的檔案。

## 官方 plugin

殼只保留傳輸、plugin 載入、本機伺服器與網頁包更新這類核心；依賴較重、不是每個 App 都需要的功能做成各自獨立的官方 plugin，需要才安裝：

官方 plugin 都在同一個 repo [aqutter-plugins](https://github.com/Aqutter/aqutter-plugins)（`packages/<資料夾>/`），可以只安裝其中一個；發佈到 npm 之後也能用套件名安裝。plugin id、npm 套件名與 Dart 套件名不因為放在同一個 repo 而改變。

| plugin | 功能 | 安裝 |
|---|---|---|
| [aqutter-plugin-battery](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/battery) | 電量與充電狀態 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/battery"` |
| [aqutter-plugin-biometrics](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/biometrics) | 叫起系統的驗證視窗（生物辨識或裝置密碼），任何時候都能呼叫；結果是客戶端判斷，不是伺服器憑證 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/biometrics"` |
| [aqutter-plugin-file-manager](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/file-manager) | 檔案管理：App 資料夾、使用者授權的資料夾、存到相簿與下載 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/file-manager"` |
| [aqutter-plugin-google-maps](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/google-maps) | 地圖鏡像到網頁，可在地圖上疊 HTML | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/google-maps"` |
| [aqutter-plugin-haptics](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/haptics) | 觸覺回饋 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/haptics"` |
| [aqutter-plugin-location](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/location) | 取得位置一次與持續監聽（前景），預設高精度；權限由網頁先要 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/location"` |
| [aqutter-plugin-mirror-demo](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/mirror-demo) | 原生 view 鏡像的示範 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/mirror-demo"` |
| [aqutter-plugin-secure-storage](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/secure-storage) | 安全儲存（Keychain／Keystore），可要求生物辨識或裝置密碼才能讀出 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/secure-storage"` |
| [aqutter-plugin-sqlite-drift](https://github.com/Aqutter/aqutter-plugins/tree/main/packages/sqlite-drift) | SQLite 資料庫：Dart 端以 drift 當 raw SQL 執行器，網頁端是 Kysely dialect `AqutterSqliteDialect`；BLOB 直接傳二進位 | `aqutter plugin add "github:Aqutter/aqutter-plugins#path:/packages/sqlite-drift"` |

拆出資料庫的實際效果（同一個暫存 App、同一台機器、各做一次完整的 Android release 建置，殼分別是拆前與拆後）：

| | 拆前（殼含 drift、sqlite3） | 拆後 | 差異 |
|---|---|---|---|
| 建置時間 | 155 秒 | 97 秒 | 少 58 秒（約 37%） |
| APK 體積 | 71,000,240 位元組 | 65,310,478 位元組 | 少 5.69 MB（約 8%） |

各只量了一次，「拆前」先跑，可能受快取影響；只量 Android，沒有量 Windows。

資料庫原本是殼的內建 handler（`db_open`、`db_exec`），已移除；舊的網頁程式要改用 plugin，遷移說明見該 plugin 的 README。

## 網頁端與型別

```ts
import { callPlugin, onPluginEvent } from '@aqutter/aqutter'
import type { PluginDefinition } from '@aqutter/aqutter'

export type HapticsContract = PluginDefinition<
  { impact: { req: { style: 'light' | 'medium' | 'heavy' }, res: { ok: true } } },
  {}
>

declare module '@aqutter/aqutter' {
  interface AqutterPluginRegistry {
    haptics: HapticsContract
  }
}
```

併入後，使用端的 `callPlugin('haptics', 'impact', { style: 'light' })` 與內建 handler 一樣有完整型別（方法名、請求、回應、事件 payload）。未發佈契約時可用 `callPluginRaw` / `onPluginEventRaw`（無型別）。

網頁端 TypeScript 以原始碼發佈（`exports` 指向 `src/`），由使用端的打包器編譯。

## 在 App 使用

```bash
aqutter plugin add aqutter-plugin-haptics           # npm 套件名
aqutter plugin add github:owner/aqutter-plugin-haptics
aqutter plugin add file:../aqutter-plugin-haptics   # 本機開發
```

`plugin add` 會：

1. 以專案的套件管理器安裝 npm 套件（Dart 原始碼隨套件一起進 `node_modules`）
2. 讀 `aqutter-plugin.json`，登記到 `aqutter.config.json` 的 `plugins`
3. 在 `<appDir>/pubspec.yaml` 的受管區塊加 Dart 路徑依賴，並重寫 `<appDir>/lib/aqutter_plugins.dart`
4. 為這個 plugin 建立使用者檔案 `<appDir>/lib/plugins/<id>_plugin.dart`（已存在就不動）

之後在 `<appDir>` 執行 `flutter pub get` 即可。移除用 `aqutter plugin remove <id>`。

### 檔案分工

| 檔案 | 誰管 | 說明 |
|---|---|---|
| `lib/aqutter_plugins.dart` | CLI，每次重寫 | 總清單：`AqutterPluginBuilder('<id>', build<Class>)` 的列表，請勿手改 |
| `lib/plugins/<id>_plugin.dart` | **你**，CLI 只在不存在時建立，永遠不覆蓋 | 這個 plugin 的建立函式，客製寫在這裡 |
| `lib/main.dart` | 你 | `plugins: aqutterPlugins` 一行，不用因為增減 plugin 而改 |

`id` 的連字號在檔名轉成底線（`google-maps` 變 `google_maps_plugin.dart`），函式名稱是 `build` 加上 plugin 的 Dart 類別名（`buildGoogleMapsPlugin`）。

### 帶參數、非同步地建立 plugin

預設的檔案長這樣，沒有選項的 plugin 不用動：

```dart
import 'dart:async';

import 'package:aqutter/aqutter.dart';
import 'package:aqutter_plugin_haptics/aqutter_plugin_haptics.dart';

/// 要給 plugin 帶參數就改這裡；aqutter CLI 之後不會覆蓋這個檔案。
FutureOr<AqutterPlugin> buildHapticsPlugin(AqutterBootContext context) => HapticsPlugin();
```

要客製就直接改這個函式，可以同步也可以非同步，需要的 `import` 也寫在這個檔案：

```dart
Future<AqutterPlugin> buildGoogleMapsPlugin(AqutterBootContext context) async {
  final prefs = await context.preferences;
  return GoogleMapsPlugin(
    apiKey: const String.fromEnvironment('MAPS_API_KEY'),   // 編譯期的 env，直接讀
    initialCamera: lastCamera(prefs),
  );
}
```

`AqutterBootContext` 提供啟動期間可安全取得的資源：

| 成員 | 說明 |
|---|---|
| `preferences` | `Future<SharedPreferences>`，與殼自己用的是同一份 |
| `supportDirectory` | `Future<Directory>`，App 的支援目錄 |
| `platform` | `TargetPlatform` |

規則：
- **這不是 `BuildContext`**：建立 plugin 時畫面還不存在。要用樹內的資源（主題、`MediaQuery`），請在 plugin 的 `buildUnderlay`、`buildOverlay` 取得 `BuildContext`，或在 `attach` 取得 `AqutterPluginContext`。
- **編譯期的 env（`--dart-define-from-file`）不經由 context**，用 `const String.fromEnvironment('KEY')`，鍵必須寫成字串常數。
- 工廠依清單順序逐一執行，每個最長 30 秒。**任何一個丟例外或逾時，整個啟動失敗**，錯誤畫面顯示 `plugin '<id>' 初始化失敗：<原因>`；殼不會略過那個 plugin 繼續啟動。
- 不使用 CLI 的人也可以自己寫：`runAqutter(plugins: [BatteryPlugin(), AqutterPluginBuilder('maps', buildMaps)])`，清單裡可以混用現成的 plugin 與工廠。

## 版本相容

App 與 plugin 的 `aqutter` 殼依賴必須使用相同的 git ref，否則 pub 解不出相依；發佈 plugin 時請在 README 註明對應的殼版本。

## 呼叫可能永遠不回應

plugin 的 handler 與它相依的系統套件有時**不會回應也不會報錯**：例如 `battery` 在沒有 UPower 服務的 Linux（WSL）上，套件在內部非同步串流裡拋出的例外不會傳回呼叫端，Dart 的 `await` 就永遠不會結束，網頁端的 `callPlugin` 也因此一直等下去。

宣告了 `supportedPlatforms` 的 plugin，在不支援的平台上呼叫會明確失敗（見上）；但「系統套件在支援的平台上卡住」這類情況仍然存在，網頁端不要假設呼叫一定會回來，尤其不要在頁面初始化的關鍵路徑上 `await` plugin：

```ts
const withTimeout = <T>(promise: Promise<T>, ms = 3000): Promise<T> => Promise.race([
  promise,
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
])

const level = await withTimeout(battery.level()).catch(() => null)
```

範本專案的 `/plugins` 頁就是因為先 `await` battery 再建立鏡像元素，在 Linux 上鏡像整塊空白（見 [Linux](linux.md)）。

## 用不了的 plugin 呼叫

網頁端 `callPlugin` 在 plugin「用不了」時**回 `undefined`、不拋錯**，正式版就不會因為缺少某個平台的實作而壞掉：

| 情況 | 結果 |
|---|---|
| 這個平台沒有實作（殼回 `UNSUPPORTED_PLATFORM`） | `undefined` |
| 這個 App 的殼沒有裝該 plugin（殼回 `HANDLER_NOT_FOUND`，例如網頁包已經 OTA 更新、殼還是舊版） | `undefined` |
| 不在 Flutter 內（純瀏覽器開發） | `undefined` |
| plugin 自己的錯誤碼、`HANDLER_FAILED`、傳輸錯誤 | 照舊拋出 `AqutterPluginError` |

- **開發階段警告**：殼在 `platform_info` 回報 `dev`（連 dev server 或 debug 建置為 true），網頁端 `setBridgeCapabilities(names, { dev })` 收下後，對每個（呼叫、原因）在 console 警告一次；正式版完全安靜。debug 建置的殼也會在日誌留一行。
- **型別**：`callPlugin` 的回傳是 `Res | undefined`，呼叫端要用 `?.` 或先判斷；plugin 的網頁 API 應在 `undefined` 時回安全的預設值（例如列表回 `[]`、讀取回 `null`），不要讓使用者碰到 `TypeError`。
- 想事先知道可不可用，仍然用 `isPluginSupported(id, method)`。
