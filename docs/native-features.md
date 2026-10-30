# 內建原生功能：剪貼簿、分享、本機通知、深層連結

這四個能力直接內建在殼的 bridge，網頁用 `callFlutter` 呼叫、用 `onFlutterEvent` 接事件，不需要另外安裝 plugin。代價是每個 App 都會帶這些原生依賴。

網頁端先用 `isBridgeSupported(BridgeHandler.X)` 判斷本平台能不能用；不支援的平台上，handler 不在能力表內，呼叫會回 `UNSUPPORTED_PLATFORM`。

| 能力 | handler | 平台 |
| :--- | :--- | :--- |
| 剪貼簿 | `clipboard_read`、`clipboard_write` | 全部 |
| 分享 | `share_open` | 全部 |
| 本機通知 | `notify_show`、`notify_schedule`、`notify_cancel`、`notify_initial`；事件 `notify_tapped` | Android、iOS、macOS |
| 深層連結 | `deeplink_initial`；事件 `deep_link` | Android、iOS、macOS |

## 剪貼簿

```ts
await callFlutter(BridgeHandler.ClipboardWrite, { text: '要複製的內容' })
const { text } = await callFlutter(BridgeHandler.ClipboardRead) // 沒有文字時 text 為 null
```

只處理純文字，上限 1,000,000 字；讀取是明確呼叫，沒有背景監聽。

## 分享

```ts
const { status } = await callFlutter(BridgeHandler.ShareOpen, { text: '看看這個', url: 'https://example.com' })
// status: 'shared' | 'dismissed' | 'unavailable'
```

`text` 與 `url` 至少一個非空；兩個都給時合成一段文字（`text`、換行、`url`）。`unavailable` 代表系統無法回報結果（例如部分 Android 的分享管道）。目前不支援分享檔案。

## 本機通知

通知**不會自動要權限**。先用既有的權限 handler 取得 `notifications`，沒授權時 `notify_show`／`notify_schedule` 會回錯誤 `permission_denied`：

```ts
const status = await callFlutter(BridgeHandler.PermRequest, { permission: 'notifications' })
if (status.status === 'granted') {
  await callFlutter(BridgeHandler.NotifyShow, { title: '訂單已出貨', body: '點擊查看', payload: 'order/42' })
}
```

| handler | 請求 | 回應 |
| :--- | :--- | :--- |
| `notify_show` | `{ id?, title, body?, payload? }` | `{ id }` |
| `notify_schedule` | 同上，另加必填 `atMs`（epoch 毫秒，須晚於現在） | `{ id }` |
| `notify_cancel` | `{ id? }`（省略＝取消全部） | `{ ok: true }` |
| `notify_initial` | 無 | `{ id, payload }`（點通知而冷啟時有值，否則兩者皆 `null`） |

- `id` 省略時由殼從 1 遞增配發；同一個 `id` 再次顯示或排程會取代原通知。殼重啟後配發從 1 重來，要跨重啟穩定請自己給 `id`。
- 限制：`title` 1–200 字、`body` ≤ 2,000 字、`payload` ≤ 1,000 字；超過回 `invalid_argument`，不截斷。
- **排程是非精確的**：Android 以不需要精確鬧鐘權限的方式排程，系統可能延後數分鐘。
- 樣式：只有標題、內文與 `payload`；Android 使用單一頻道 `aqutter_default`（名稱「通知」），圖示用 App 的啟動圖示。
- 點通知：App 在執行中時收到事件 `notify_tapped`（`{ id, payload }`）；App 被關掉、點通知而啟動時，網頁就緒後呼叫 `notify_initial` 取得。`payload` 殼原樣帶回，不解讀。

### 各 App 要做的原生設定

`aqutter init` 展開的原生專案屬於各 App，**CLI 的 upgrade 不會改**。新建的 App 範本已含下列兩項；既有 App 請自己套用：

Android：`android/app/build.gradle.kts` 啟用核心函式庫去糖（本機通知外掛需要）：

```kotlin
android {
    compileOptions {
        isCoreLibraryDesugaringEnabled = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
```

iOS：`ios/Runner/AppDelegate.swift` 把通知代理設為 App 本身（App 在前景時也能顯示通知）：

```swift
import UserNotifications

// application(_:didFinishLaunchingWithOptions:) 內，super 呼叫之前
UNUserNotificationCenter.current().delegate = self
```

## 深層連結

啟動 App 的連結與執行中收到的連結分開處理：

```ts
const { url } = await callFlutter(BridgeHandler.DeeplinkInitial) // 啟動 App 的連結，沒有則 null；重複呼叫回傳相同值
onFlutterEvent(BridgeEvent.DeepLink, ({ url }) => { /* App 執行中收到的新連結 */ })
```

啟動 App 的那一個連結**只由 `deeplink_initial` 取得，不會再以事件送一次**：事件在網頁尚未連線時會被丟棄，冷啟必須有可重複讀取的來源。**殼不檢查連結內容，網頁收到後要自行驗證（scheme、網域、路徑）再導航。**

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

iOS：`ios/Runner/Info.plist` 加入自訂 scheme：

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

### 用 adb 測試（Android）

```bash
adb shell am start -a android.intent.action.VIEW -d "myapp://open/1" <套件名稱>
```

## 錯誤碼

| 錯誤碼 | 觸發條件 | 處置 |
| :--- | :--- | :--- |
| `invalid_argument` | 欄位缺漏、型別錯、超過上限、`atMs` 已過 | 修正參數，不要重試 |
| `permission_denied` | 通知權限未授權 | 先用權限 handler 要求 `notifications`；永久拒絕時引導到系統設定 |
| `UNSUPPORTED_PLATFORM` | 本平台不支援（通知、深層連結在 Windows、Linux） | 用 `isBridgeSupported` 先判斷 |
