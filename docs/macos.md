# macOS 佈線

`aqutter init` 的範本已含 `macos/`，以下修改**皆已由範本設定好**；本文說明各項內容與原因，客製或除錯時參照。macOS App 預設 **App Sandbox**，網路與檔案能力需以 entitlement 明確開啟。

## 1. Entitlements（`macos/Runner/*.entitlements`）

`DebugProfile.entitlements`（Debug/Profile）與 `Release.entitlements`（Release）範本已讓兩者都具備下列鍵（Flutter 預設 Debug 僅含 `network.server`，其餘為範本補齊）：

```xml
<!-- shelf loopback server 監聽 127.0.0.1 -->
<key>com.apple.security.network.server</key>
<true/>
<!-- dio HTTP / dev server / TCP 印表機連出 -->
<key>com.apple.security.network.client</key>
<true/>
<!-- file_picker：使用者選取的檔案讀寫 -->
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
<!-- permission_plus：沙盒下取得相機 / 麥克風 / 定位 -->
<key>com.apple.security.device.camera</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.personal-information.location</key>
<true/>
```

> `app-sandbox` 保留為 `true`。其他能力（藍牙、通訊錄、行事曆、相簿）若日後在 macOS 使用，需再加對應 entitlement，鍵名見 `permission_plus` 的 README。

## 2. App Transport Security（本機 shelf server 為 http）

`macos/Runner/Info.plist` 已由範本設定好，允許 loopback cleartext（WKWebView 載入 `http://127.0.0.1`）：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

## 3. 權限 usage description（`Info.plist`）

範本已含下列描述鍵（permission_plus 會讀取），文字請改成自己的用途說明，並依實際用到的能力增減：

```xml
<key>NSLocalNetworkUsageDescription</key><string>需要本地網路以連線印表機</string>
<key>NSCameraUsageDescription</key><string>需要相機以…</string>
<key>NSMicrophoneUsageDescription</key><string>需要麥克風以…</string>
<key>NSLocationWhenInUseUsageDescription</key><string>需要定位以…</string>
```

> [!NOTE]
> **macOS 的權限由 `permission_plus` 提供。** 前身 `permission_handler` 沒有 macOS 實作，呼叫會擲 `MissingPluginException`；`permission_plus` 經 `permission_plus_apple`（iOS / macOS 共用同一份 Swift 原始碼，附 `Package.swift`）支援 macOS。
>
> 缺少 usage description 或 entitlement 時，系統在權限被請求的當下會拒絕或終止 app。**通知權限**在 ad-hoc 簽章（`flutter run` 未設定 Apple Developer Team）下會直接回 `permanentlyDenied` 且不跳提示；要實測請在 Xcode 開 `macos/Runner.xcworkspace` 以有效的 Developer Team 簽章。

## 4. In-App Browser（平台差異）

`AqutterChromeSafariBrowser`（SFSafariViewController）為 **iOS 專屬**。macOS 上 `iab_open`（`bridge_registry.dart`）會退回 `aqutter_core` 的一般 `AqutterBrowser` 或以 `url_launcher` 外開。若 macOS 目標需完整 In-App Browser 行為，另行評估。

## 5. 最小化（選配）

`minimize_app` handler 已於未佈線平台（含 macOS）以 try/catch 安全 no-op。若要在 macOS 實作視窗最小化，可於 `MainFlutterWindow.swift` 註冊 `app/host` MethodChannel 並呼叫 `window.miniaturize(nil)`。本期未實作。

## 6. 建置

```bash
aqutter seed                 # 產生 <appDir>/assets/seed/web-bundle.zip（網頁框架靜態輸出）
aqutter build macos          # 或 aqutter dev macos
```

## 7. 測試權限

> [!WARNING]
> **用 `aqutter dev macos`（底層為 `flutter run`）啟動的 app，沒辦法正確測權限。** 此時 app 是命令列程序的子程序，macOS 會把相機、麥克風等授權請求算到「責任程序」（啟動它的終端機或工具）頭上，而不是 `<appName>` 本身。症狀是系統設定「隱私權與安全性」的清單裡**沒有**這個 app，請求被直接拒絕（相機回 `permanentlyDenied`），且不會跳出屬於 app 的授權視窗。

要讓授權記錄與視窗屬於 app 自己，改由系統單獨啟動已編譯好的 app：

1. 先用 `aqutter dev macos` 建置一次。開發網址是編譯期寫進 app 的，所以不能跳過這一步。
2. 停掉 `aqutter dev macos`，另外啟動你的網頁專案 dev server（用你的框架自己的指令，埠號與先前 `AQUTTER_DEV_URL` 一致）。

3. 用 `open` 啟動已編譯的 app：

   ```bash
   open <appDir>/build/macos/Build/Products/Debug/<appName>.app
   ```

4. 在 app 的權限卡片按 Request。此時系統視窗屬於 `<appName>`，授權後它會出現在「系統設定 → 隱私權與安全性 → 相機」的清單裡。

要重新測某一項權限時，先重置該項的系統記錄，**再重啟 app**：

```bash
tccutil reset Camera <orgId>.<appName>
```

> [!NOTE]
> 授權狀態會快取在執行中的程序裡，重置後不重啟 app，畫面上仍會是舊狀態。麥克風把 `Camera` 換成 `Microphone`；定位的授權不一定由 `tccutil` 管理，未驗證。不帶 bundle id 會重置該服務下**所有** app，**不建議**。
