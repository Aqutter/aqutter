# 內建原生功能：剪貼簿、分享、本機通知、深層連結

這四個能力是殼內建的 plugin（`clipboard`、`share`、`notification`、`deeplink`），不需要另外安裝，也不需要在 `runAqutter(plugins: …)` 傳入；寫法和一般 plugin 完全一樣：網頁用 `callPlugin(id, method, payload)` 呼叫、用 `onPluginEvent(id, event, listener)` 接事件，handler 名稱是 `<id>.<method>`、事件頻道是 `<id>.<event>`。代價是每個 App 都會帶這些原生依賴。

網頁端先用 `isPluginSupported(id, method)` 判斷本平台能不能用；不支援的平台上，該方法不在能力表內，呼叫會回 `UNSUPPORTED_PLATFORM`。

| plugin | 方法 | 事件 | 平台 |
| :--- | :--- | :--- | :--- |
| `clipboard`（文字） | `read`、`write` | — | 全部 |
| `clipboard`（圖片） | `readImage`、`writeImage` | — | Android、iOS、macOS、Windows |
| `share`（文字、網址、檔案） | `open` | — | 全部 |
| `notification` | `show`、`schedule`、`cancel`、`initial` | `tapped` | Android、iOS、macOS |
| `deeplink` | `initial` | `received` | Android、iOS、macOS |

`clipboard`、`share`、`notification`、`deeplink` 是保留的 plugin id：自己寫的 plugin 不能取同名，否則組裝時會丟 `ArgumentError`（重複的 plugin id）。

### 從舊名稱遷移

以前這四個功能是殼的固定 handler（`callFlutter(BridgeHandler.X)`、`onFlutterEvent(BridgeEvent.X)`）。現在舊名稱**已移除**，沒有別名，請改用下表的新名稱（網頁端型別在 `@aqutter/aqutter` 的 `AqutterPluginRegistry`，請求與回應的欄位都沒變）：

| 舊名稱 | 新寫法 |
| :--- | :--- |
| `BridgeHandler.ClipboardRead`（`clipboard_read`） | `callPlugin('clipboard', 'read')` |
| `BridgeHandler.ClipboardWrite`（`clipboard_write`） | `callPlugin('clipboard', 'write', { text })` |
| `BridgeHandler.ClipboardReadImage`（`clipboard_read_image`） | `callPlugin('clipboard', 'readImage')` |
| `BridgeHandler.ClipboardWriteImage`（`clipboard_write_image`） | `callPlugin('clipboard', 'writeImage', { data, mimeType })` |
| `BridgeHandler.ShareOpen`（`share_open`） | `callPlugin('share', 'open', request)` |
| `BridgeHandler.NotifyShow`（`notify_show`） | `callPlugin('notification', 'show', request)` |
| `BridgeHandler.NotifySchedule`（`notify_schedule`） | `callPlugin('notification', 'schedule', request)` |
| `BridgeHandler.NotifyCancel`（`notify_cancel`） | `callPlugin('notification', 'cancel', { id })` |
| `BridgeHandler.NotifyInitial`（`notify_initial`） | `callPlugin('notification', 'initial')` |
| `BridgeEvent.NotifyTapped`（`notify_tapped`） | `onPluginEvent('notification', 'tapped', listener)` |
| `BridgeHandler.DeeplinkInitial`（`deeplink_initial`） | `callPlugin('deeplink', 'initial')` |
| `BridgeEvent.DeepLink`（`deep_link`） | `onPluginEvent('deeplink', 'received', listener)` |
| `isBridgeSupported(BridgeHandler.X)` | `isPluginSupported('<id>', '<method>')` |

## 剪貼簿

```ts
await callPlugin('clipboard', 'write', { text: '要複製的內容' })
const { text } = await callPlugin('clipboard', 'read') // 沒有文字時 text 為 null
```

純文字上限 1,000,000 字；讀取是明確呼叫，沒有背景監聽。

### 剪貼簿圖片

```ts
await callPlugin('clipboard', 'writeImage', { data: pngBytes, mimeType: 'image/png' }) // PNG 或 JPEG，≤ 5 MiB
const { image } = await callPlugin('clipboard', 'readImage') // { mimeType: 'image/png', data } 或 null
```

- 讀出來的圖片一律是 PNG；其他格式（JPEG、BMP…）由殼轉成 PNG。圖片超過 5,242,880 位元組時回錯誤 `too_large`，不截斷。
- 寫入前殼會檢查位元組開頭與 `mimeType` 相符，不符回 `invalid_argument`。
- 由殼套件自己的原生程式實作（殼套件本身是 Flutter plugin，不依賴外部剪貼簿套件），**App 不需要改自己的原生專案**；Android 的 provider 由殼自己宣告。Linux 不支援。

## 分享

```ts
const { status } = await callPlugin('share', 'open', { text: '看看這個', url: 'https://example.com' })
// status: 'shared' | 'dismissed' | 'unavailable'
```

`text`、`url`、`files` 至少一個有內容；`text` 與 `url` 都給時合成一段文字（`text`、換行、`url`）。`unavailable` 代表系統無法回報結果（例如部分 Android 的分享管道）。

### 分享檔案（含圖片）

```ts
const logo = new Uint8Array(await (await fetch('/assets/logo.png')).arrayBuffer())
await callPlugin('share', 'open', {
  text: 'Aqutter',
  files: [{ name: 'logo.png', mimeType: 'image/png', data: logo }],
})
```

- 最多 5 個檔案，每個 ≤ 5 MiB；`name` 必須是單一檔名（不含路徑分隔、不為 `.`／`..`、≤ 128 字）。
- `mimeType` 省略時依副檔名判斷；分享圖片請給 `image/png`／`image/jpeg`，系統才會用圖片的方式處理。
- 殼把檔案暫存到暫存目錄（每次分享一個獨立資料夾）交給系統分享面板，分享結束後盡力刪除，不修改內容。

## 本機通知

通知**不會自動要權限**。先用既有的權限 handler 取得 `notifications`，沒授權時 `notification.show`／`notification.schedule` 會回錯誤 `permission_denied`：

```ts
const status = await callFlutter(BridgeHandler.PermRequest, { permission: 'notifications' })
if (status.status === 'granted') {
  await callPlugin('notification', 'show', { title: '訂單已出貨', body: '點擊查看', payload: 'order/42' })
}
```

| 方法 | 請求 | 回應 |
| :--- | :--- | :--- |
| `notification.show` | `{ id?, title, body?, payload? }` | `{ id }` |
| `notification.schedule` | 同上，另加必填 `atMs`（epoch 毫秒，須晚於現在） | `{ id }` |
| `notification.cancel` | `{ id? }`（省略＝取消全部） | `{ ok: true }` |
| `notification.initial` | 無 | `{ id, payload }`（點通知而冷啟時有值，否則兩者皆 `null`） |

- `id` 省略時由殼從 1 遞增配發；同一個 `id` 再次顯示或排程會取代原通知。殼重啟後配發從 1 重來，要跨重啟穩定請自己給 `id`。
- 限制：`title` 1–200 字、`body` ≤ 2,000 字、`payload` ≤ 1,000 字；超過回 `invalid_argument`，不截斷。
- **排程是非精確的**：Android 以不需要精確鬧鐘權限的方式排程，系統可能延後數分鐘。
- 樣式：只有標題、內文與 `payload`；Android 使用單一頻道 `aqutter_default`（名稱「通知」），圖示用 App 的啟動圖示。
- 點通知：App 在執行中時收到事件 `notification.tapped`（`{ id, payload }`）；App 被關掉、點通知而啟動時，網頁就緒後呼叫 `notification.initial` 取得。`payload` 殼原樣帶回，不解讀。

### 原生設定

**不需要**。通知由殼套件自己的原生程式實作（不依賴外部通知套件）：Android 的接收器、頻道與必要權限（`POST_NOTIFICATIONS` 由 App 範本宣告，`RECEIVE_BOOT_COMPLETED` 由殼宣告）由殼的 manifest 自動合併，iOS 與 macOS 的通知代理由殼在啟動時自己設定。App 的 `AppDelegate` 與 Gradle 設定都不用改。

- **重開機後（Android）**：殼會把尚未到時間的排程通知重新排上，已經過了時間的不補發；App 更新後同樣會重新排上。
- **iOS** 同時最多 64 則待送通知（系統限制）。
- 小圖示使用 App 的啟動圖示；想要單色的狀態列圖示，之後可以再加。

## 深層連結

啟動 App 的連結與執行中收到的連結分開處理：

```ts
const { url } = await callPlugin('deeplink', 'initial') // 啟動 App 的連結，沒有則 null；重複呼叫回傳相同值
onPluginEvent('deeplink', 'received', ({ url }) => { /* App 執行中收到的新連結 */ })
```

啟動 App 的那一個連結**只由 `deeplink.initial` 取得，不會再以事件送一次**：事件在網頁尚未連線時會被丟棄，冷啟必須有可重複讀取的來源。**殼不檢查連結內容，網頁收到後要自行驗證（scheme、網域、路徑）再導航。**

### 各 App 要做的原生設定

連結的 scheme 與網域屬於各 App，範本不預設。

Android：`android/app/src/main/AndroidManifest.xml` 的 `MainActivity` 內加入（自訂 scheme 與 App Links 擇一或並用）：

```xml
<!-- 自訂 scheme：myapp://… -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" />
</intent-filter>

<!-- App Links：https://example.com/… -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="example.com" />
</intent-filter>
```

App Links 還要在網站放 `https://example.com/.well-known/assetlinks.json`（套件名稱與簽署憑證指紋）。

iOS 與 macOS：`ios/Runner/Info.plist` 與 `macos/Runner/Info.plist` 都用同一個 `CFBundleURLTypes` 鍵加入自訂 scheme（兩個平台各自的檔案都要加）：

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array><string>myapp</string></array>
    </dict>
</array>
```

Universal Links 需要在 Xcode 的 Signing & Capabilities 加入 Associated Domains（`applinks:example.com`），並在網站放 `apple-app-site-association`。

### 自訂 scheme 與行為

**框架與範本不預設任何 scheme**：新建的專案沒有登記任何自訂連結，要用深層連結的 App 自己決定。要改的地方分兩處：

| 想改的 | 改哪裡 |
| :--- | :--- |
| scheme、網域（哪些連結會開啟這個 App） | 上面的原生設定：Android 的 `AndroidManifest.xml`、iOS 與 macOS 的 `Info.plist`，換成自己的 scheme 或網域即可 |
| 收到連結之後做什麼（導到哪一頁、帶什麼參數） | 寫在網頁端。殼只把原始連結字串交給網頁，不檢查、不導航 |

網頁端的處理範例（先驗證，再導航）：

```ts
const handle = (raw: string) => {
  const link = new URL(raw)
  if (link.protocol !== 'myapp:') return // 只認自己的 scheme，其他一律忽略
  navigateTo(link.pathname) // 依 host／path／參數決定要去哪
}

const { url } = await callPlugin('deeplink', 'initial') // 冷啟動的連結
if (url) handle(url)
onPluginEvent('deeplink', 'received', ({ url }) => handle(url)) // 執行中收到的連結
```

### 用 adb 測試（Android）

```bash
adb shell am start -a android.intent.action.VIEW -d "myapp://open/1" <套件名稱>
```

## 錯誤碼

| 錯誤碼 | 觸發條件 | 處置 |
| :--- | :--- | :--- |
| `invalid_argument` | 欄位缺漏、型別錯、超過上限、`atMs` 已過、圖片格式與 `mimeType` 不符 | 修正參數，不要重試 |
| `too_large` | 剪貼簿裡的圖片超過 5 MiB（`clipboard.readImage`） | 改用較小的圖片，不要重試 |
| `permission_denied` | 通知權限未授權 | 先用權限 handler 要求 `notifications`；永久拒絕時引導到系統設定 |
| `UNSUPPORTED_PLATFORM` | 本平台不支援（通知、深層連結在 Windows、Linux；圖片剪貼簿在 Linux） | 用 `isPluginSupported` 先判斷 |
