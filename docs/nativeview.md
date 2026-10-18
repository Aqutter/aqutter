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

元素自動辨識手勢並回傳（座標為 0..1 正規化值）：`tap`、`doubleTap`、`longPress`、`pan`（`phase` start / update / end）、`pinch`（`phase`、`scale`）。完整欄位與規則見原生端文件與 `GestureRecognizer` 的註解。

元素的 `input` 屬性決定回傳什麼：

| `input` | 回傳 | 誰判斷手勢 |
|---|---|---|
| `gestures`（預設） | 判斷好的語意手勢 | 網頁 |
| `pointers` | 原始指標事件（down／move／up／cancel，附硬體時間戳） | Flutter：原生端開 `injectPointers: true`，被鏡像的 widget 直接用標準 `GestureDetector`／地圖手勢 |
| `both` | 兩者都送 | 兩邊都判斷，通常用不到 |

單擊與雙擊的關係由 `double-tap` 屬性決定：

| `double-tap` | 行為 | 代價 |
|---|---|---|
| `exclusive`（預設） | 互斥：雙擊只送 `doubleTap`，不會同時送 `tap` | 單擊要等雙擊視窗（`double-tap-ms`，Android 等預設 130 ms、iOS 預設 300 ms）過了才確定，晚這麼久送出 |
| `both` | 每一下立刻送 `tap`，第二下之後再送 `doubleTap`（雙擊會同時有兩次 `tap` 與一次 `doubleTap`） | 無延遲，但雙擊與單擊都會觸發 |
| `off` | 不辨識雙擊，每一下立刻送 `tap` | 無延遲，沒有 `doubleTap` |

`max-in-flight`（1 到 8 或 `auto`）：這個鏡像每個連線最多同時有幾幀已送出但未被確認；預設 3，調成 1 沒有排隊、傳輸受限的大幀內容延遲可降到約三分之一，擷取受限的內容（地圖）沒有差別，執行中改屬性即生效。`auto` 由原生端探測後自動選擇，是實驗功能：持續播放的動畫上能保住幀率並降低最大延遲，手勢互動的地圖上反而較差，不建議用在地圖。

其他門檻可用屬性覆寫：`double-tap-ms`（第一下放開到第二下按下的上限；預設 130，**iOS（含 iPadOS）預設 300**：iPad 實機量到真人的快速雙擊約 225 到 260 ms，Android 的雙擊在 130 ms 內。這是兩台裝置各一組的實測，不是平台規格）、`double-tap-min-ms`（下限，預設 40，更短視為觸控誤報而不是雙擊）、`double-tap-distance`（兩下的最大距離，CSS 像素；預設 32，iOS 預設 80；iPad 實機量到快速連點的兩下常相距 50 到 160 像素，40 會讓多數雙擊判成兩個單擊；手指在平板上自然會偏移，太小會讓 iPad 的快速雙擊點不中，而且距離無法區分連點計數與雙擊，因為連點的手指也在同一處）、`slop`（判定為拖曳的移動距離，CSS 像素；預設 8，iOS 預設 18：手指按下時自然滑動，8 會把不少點擊判成拖曳，第二下一變成拖曳雙擊就湊不成）、`long-press-ms`（預設 500）。

殼的 iOS WebView 開了 `preventGestureDelay`，關掉 Flutter 平台視圖的 `FlutterDelayingGestureRecognizer`；沒開時，快速連點的第二下進不了網頁（pointer／touch 事件只收到第一下），雙擊永遠判不出來。

即使如此，iOS 的 App 內 WebView 仍可能吞掉快速連點的第二下，只留下一個沒有對應 `pointerup` 的 `click`（實機：一次快速雙擊 = 一組 down／up，加上先後兩個 click）。`<aqutter-native>` 把這種 click 補成一次按下加放開交給辨識器；觸控不做明確的指標捕捉。根因尚未查明，這是繞過去的做法。

快速連點計數（放開到再按下約 150 到 250 ms）與刻意雙擊（約 80 到 150 ms）的間隔有重疊，單看時間分不乾淨：連點被誤判成雙擊就調小 `double-tap-ms`，真的雙擊點不中就調大。同一個區域同時要「連點計數」與「雙擊」時，兩者本質上會互相干擾，建議改用不同的操作（例如長按）。

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

PlatformView 在 iOS 需 `nativeCapture: true`（可加 `nativeViewTypeContains: 'GMSMapView'`）。以 Google Maps 為例：把 `GoogleMap` 當 `child`，在 `onMessage` 用 `GoogleMapController` 套用 `pan` / `pinch`。完整實作見 [aqutter-plugin-google-maps](https://github.com/Aqutter/aqutter-plugin-google-maps)（Android、iOS；含 API key 設定）；純 Flutter 畫面的範例見 [aqutter-plugin-mirror-demo](https://github.com/Aqutter/aqutter-plugin-mirror-demo)。iOS 的 PlatformView 不接受注入的 Flutter 指標事件，地圖類請用語意手勢（`input="gestures"`）換成相機操作。

## 效能

網頁端會自動：只畫最新一幀、每幀回 `ack`（原生端據此流量控制）、元素大小改變時回報 `resize`（原生端只擷取需要的像素）、元素不可見時回報 `visibility`（原生端暫停擷取）、RGBA 不複製像素（`ImageData` 直接包住收到的像素緩衝區）。「可見」指元素在視窗內（`display: none` 或被捲出畫面都算看不到）且分頁沒有被隱藏；重新可見時原生端立刻補一幀。原生端沒重繪就不送幀。機制與協定欄位見 [aqutter_core 的 doc/nativeview.md](https://github.com/Aqutter/aqutter_core/blob/main/doc/nativeview.md)。`aqutter-frame` 事件的 `detail` 帶 `bytes`、`latencyMs`、`drawMs`，可用來觀察實際頻寬、延遲與繪製耗時；原生端的各階段耗時與實測數字見上述文件的「量測」一節。

## 網頁的 CSP

網頁若設定 Content-Security-Policy，`connect-src` 需允許 `ws://127.0.0.1:*`。

## 限制

- 傳輸為未壓縮 RGBA / PNG；H.264 + WebCodecs 尚未實作。
- 已驗證：macOS、Android 模擬器、iOS 模擬器上鏡像 Flutter widget、手勢回控。
- 尚未驗證：iOS `drawHierarchy` 與 Android PlatformView 的擷取、實體裝置。
