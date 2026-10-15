# Plugin 開發

Plugin 讓第三方擴充 Aqutter：同一個 repo 同時是 **npm 套件**（網頁端 API 與型別）與 **Dart 套件**（Flutter 端實作）。Plugin 可以：

- 對網頁暴露方法（網頁 `callPlugin(id, method, payload)` → Dart handler）
- 主動對網頁派送事件（Dart `context.emit` → 網頁 `onPluginEvent`）
- 在 WebView 之上掛原生 Flutter UI
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
| `handlers` | 暴露給網頁的方法；回傳值須可 JSON 序列化 |
| `attach(context)` | 殼就緒後呼叫一次；以 `context.emit(event, payload)` 派送事件 |
| `buildOverlay(context)` | 疊在 WebView 之上、啟動過場之下的 UI；需要吃觸控請自行限定範圍 |
| `dispose()` | 殼結束時釋放資源 |

Plugin 的 handler 會列入 `platform_info` 的 `capabilities`，網頁以 `isPluginSupported(id, method)` 查詢（沒裝該 plugin 的 App 為 `false`）。

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
