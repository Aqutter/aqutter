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
| 被呼叫時 | 殼**不執行**你的 handler，回傳 `{ aqutterError: { code: 'UNSUPPORTED_PLATFORM', message } }`；網頁端 `callPlugin` 把它轉成拋出的 `AqutterPluginError`（`error.code === 'UNSUPPORTED_PLATFORM'`），不會卡住 |
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

不支援的方法行為和上表相同（仍註冊、不列入 `capabilities`、呼叫回 `UNSUPPORTED_PLATFORM`），只影響那一個方法。`attach` 在 plugin 層或任一方法支援目前平台時呼叫。

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

## 官方 plugin

殼只保留傳輸、plugin 載入、本機伺服器與網頁包更新這類核心；依賴較重、不是每個 App 都需要的功能做成各自獨立的官方 plugin，需要才安裝：

| plugin | 功能 | 安裝 |
|---|---|---|
| [aqutter-plugin-sqlite-drift](https://github.com/Aqutter/aqutter-plugin-sqlite-drift) | SQLite 資料庫：Dart 端以 drift 當 raw SQL 執行器，網頁端是 Kysely dialect `AqutterSqliteDialect`；BLOB 直接傳二進位 | `aqutter plugin add aqutter-plugin-sqlite-drift` |

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

之後在 `<appDir>` 執行 `flutter pub get` 即可。移除用 `aqutter plugin remove <id>`。

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
