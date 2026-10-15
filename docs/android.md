# Android 佈線

`aqutter init` 以範本建立的 App 目錄（預設 `aqutter/`，即 `appDir`）已含 `android/`，以下各項**皆已由範本設定好**；本文說明各項內容與原因，客製或除錯時參照。

## 1. 權限（`android/app/src/main/AndroidManifest.xml`）

已由範本設定好：`<manifest>` 內、`<application>` 前宣告如下，依實際用到的能力增減：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<!-- 依實際用到的能力增減（權限走 permission_plus）。未宣告的權限，系統不會跳授權視窗，直接視為拒絕 -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- Android 13（API 33）起通知才是執行期權限 -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## 2. Cleartext loopback（本機 shelf server 為 http）

Android 9+ 預設封鎖 cleartext。已由範本設定好 loopback 白名單：

`android/app/src/main/res/xml/network_security_config.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
```

`AndroidManifest.xml` 的 `<application>` 已引用：
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
```

> dev（連 PC IP 的 dev server）時，另把該 IP 也加入上面的 `domain-config`，或改用 `android:usesCleartextTraffic="true"`（僅 debug build）。

## 3. 最小化 App（`minimize_app` handler 的 MethodChannel）

`bridge_registry.dart` 以 `MethodChannel('app/host')` 呼叫 `minimize`。已由範本設定好，`MainActivity.kt` 的實作如下：

```kotlin
package <orgId>.<appName>

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "app/host")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "minimize" -> { moveTaskToBack(true); result.success(null) }
                    else -> result.notImplemented()
                }
            }
    }
}
```

## 4. Foreground Service（背景執行，**本期僅預留**）

本期不實作，僅記錄接法，日後另開計畫：

- 套件建議：`flutter_foreground_task`（常駐通知 + 背景執行）或 `workmanager`（定期任務）。
- Manifest 需宣告 `FOREGROUND_SERVICE`（及 Android 14 的 `FOREGROUND_SERVICE_*` 細類型）與 service。
- 於 `main.dart` 啟動時初始化 foreground task，將需背景續跑的工作（如長輪詢、上傳佇列）移入其 isolate。
- 與本殼的整合點：background isolate 可重用 `lib/db`、`lib/bridge/*_service.dart` 的服務層（與 WebView 解耦）。

## 5. 應用圖示 / 名稱

依專案需要設定 `android:label` 與 `mipmap` 圖示（範本為預設圖示，請替換為自己的素材）。

## 6. 系統列隱藏的重貼時機與 `configChanges`

網頁層送的 `system_bars_hide` 是一次性請求，系統會在多個時機自行還原系統列；`MainActivity` 以 `systemBarsHidden` 記住意圖並重貼。以下是三條佈線硬規則：

- **focus / resume 的重貼一律 `post` 到下一輪**（`reassertSystemBarsHidden()`）：焦點與生命週期事件先派給 Activity 再往 view tree 傳，同步重貼會緊接著被 `FlutterView` 重貼的 `SystemUiMode.edgeToEdge` 蓋掉，狀態列又跑回來。`decorView.post` 讓重貼落在整輪派送之後；lambda 內再檢查一次 `systemBarsHidden`，排隊期間網頁若已改送 show 不得拿舊意圖覆蓋。`onResume` 也要重貼——Activity 重建後網頁不會重新掛載、不會再送一次 hide。
- **API < 30 先 `show()` 再 `hide()`**：`WindowInsetsControllerCompat.hide()` 在 30 以下只是把 legacy `SYSTEM_UI_FLAG_*` 或進 decorView 既有旗標，值沒變時 `setSystemUiVisibility` 視為 no-op、WindowManager 不重新套用，結果「旗標說已隱藏、狀態列卻還在」。先 show 讓值確實變一次。
- **`android:configChanges` 必含 `navigation`**：藍牙 HID 鍵盤（掃描槍）連線／斷線時系統送 `Config changes=0x70`（keyboard|keyboardHidden|navigation），清單缺任一項 Activity 就會重建，FlutterEngine 與 AqutterWebView 一起重建、網頁整個重載。本殼範本已設定好的清單 = 常見 WebView 殼預設 + Flutter 預設額外的 `layoutDirection|fontScale|density`：

  ```
  orientation|keyboardHidden|keyboard|navigation|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode
  ```

驗證（實機）：`adb shell settings put global always_finish_activities 1` 後 HOME 再重啟 App 重複數次，狀態列每次都應隱藏（測完改回 `0`）；藍牙 HID 配對／斷線時 logcat 有 `Config changes=70` 但無 Activity 重建、無 Impeller 重新初始化；`aapt dump xmltree` 的 `configChanges` 值應含 `0x40`。
