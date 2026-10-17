# Native view 鏡像（網頁端）

把 Flutter 內容（Widget 或 PlatformView，如地圖）即時鏡像到網頁的 canvas，並讓網頁的手勢與指令回控原生內容。網頁因此能在原生內容**之上**疊 HTML、做 z-index 與圖層合成。原生端與協定見 [aqutter_core 的 doc/nativeview.md](https://github.com/Aqutter/aqutter_core/blob/main/doc/nativeview.md)。

## 網頁端：`<aqutter-native>`

```ts
import '@aqutter/aqutter/native'   // 副作用：註冊 <aqutter-native>
```

```html
<aqutter-native session="map" fit="cover" style="position:fixed;inset:0"></aqutter-native>
<div class="hud">這是疊在原生內容之上的 HTML</div>
```

| 屬性 | 說明 |
|---|---|
| `session` | 與原生端 `AqutterNative(sessionId: …)` 一致（必填） |
| `fit` | `fill`（預設）/ `contain` / `cover` |

| 事件 / 方法 | 說明 |
|---|---|
| `aqutter-status` | `detail.connected` |
| `aqutter-frame` | `detail.width` / `height` / `bytes` / `latencyMs` |
| `send(message)` | 送訊息給原生端；未連線回 `false` |
| `sendCommand(name, args?)` | 送 `command` 訊息 |

元素自動辨識手勢並回傳（座標為 0..1 正規化值）：`tap`、`doubleTap`（第二下會先送 `tap` 再送 `doubleTap`，連點每下都有 `tap`）、`longPress`、`pan`（`phase` start / update / end）、`pinch`（`phase`、`scale`）。完整欄位與規則見原生端文件與 `GestureRecognizer` 的註解。

元素的 `input` 屬性決定回傳什麼：

| `input` | 回傳 | 誰判斷手勢 |
|---|---|---|
| `gestures`（預設） | 判斷好的語意手勢 | 網頁 |
| `pointers` | 原始指標事件（down／move／up／cancel，附硬體時間戳） | Flutter：原生端開 `injectPointers: true`，被鏡像的 widget 直接用標準 `GestureDetector`／地圖手勢 |
| `both` | 兩者都送 | 兩邊都判斷，通常用不到 |

語意手勢的門檻可用元素屬性覆寫：`double-tap-ms`（第一下放開到第二下按下，預設 180）、`double-tap-distance`（兩下的最大距離，CSS 像素，預設 24）、`long-press-ms`（預設 500）。快速連點計數的場景若仍被誤判成雙擊，調小 `double-tap-ms`；不需要雙擊時直接不處理 `doubleTap` 即可（第二下仍會先送 `tap`）。

被鏡像的是地圖之類的原生 view 時，它需要的是真實的指標事件而不是 tap／pan 的語意結果，應使用 `pointers`。

不想註冊元素、要自己畫時，可直接用 `AqutterNative`：

```ts
import { AqutterNative, callFlutter } from '@aqutter/aqutter'
import { BridgeHandler } from '@aqutter/aqutter/contract'

const mirror = new AqutterNative({
  session: 'map',
  canvas,
  resolveEndpoint: () => callFlutter(BridgeHandler.NativeEndpoint),
})
mirror.start()
```

`import '@aqutter/aqutter'` 在伺服端渲染（沒有 `HTMLElement`）時是安全的；元素類別只在 `defineAqutterNative()` 時才建立。

## Flutter 端（在 App 或 plugin 內）

```dart
// plugin 的 buildUnderlay：墊在 WebView 之下、被網頁蓋住但仍在 Flutter 渲染
AqutterNative(
  sessionId: 'map',
  onMessage: (message) { /* 套用手勢 */ },
  child: MyWidget(),
)
```

PlatformView 在 iOS 需 `nativeCapture: true`（可加 `nativeViewTypeContains: 'GMSMapView'`）。以 Google Maps 為例：把 `GoogleMap` 當 `child`、停用它自己的手勢，在 `onMessage` 用 `GoogleMapController` 套用 `pan` / `pinch`。範例 plugin：[aqutter-plugin-mirror-demo](https://github.com/Aqutter/aqutter-plugin-mirror-demo)。

## 效能

網頁端會自動：只畫最新一幀、每幀回 `ack`（原生端據此流量控制）、元素大小改變時回報 `resize`（原生端只擷取需要的像素）、元素不可見時回報 `visibility`（原生端暫停擷取）、RGBA 不複製像素（`ImageData` 直接包住收到的像素緩衝區）。「可見」指元素在視窗內（`display: none` 或被捲出畫面都算看不到）且分頁沒有被隱藏；重新可見時原生端立刻補一幀。原生端沒重繪就不送幀。機制與協定欄位見 [aqutter_core 的 doc/nativeview.md](https://github.com/Aqutter/aqutter_core/blob/main/doc/nativeview.md)。`aqutter-frame` 事件的 `detail` 帶 `bytes`、`latencyMs`、`drawMs`，可用來觀察實際頻寬、延遲與繪製耗時；原生端的各階段耗時與實測數字見上述文件的「量測」一節。

## 網頁的 CSP

網頁若設定 Content-Security-Policy，`connect-src` 需允許 `ws://127.0.0.1:*`。

## 限制

- 傳輸為未壓縮 RGBA / PNG；H.264 + WebCodecs 尚未實作。
- 已驗證：macOS、Android 模擬器、iOS 模擬器上鏡像 Flutter widget、手勢回控。
- 尚未驗證：iOS `drawHierarchy` 與 Android PlatformView 的擷取、實體裝置。
