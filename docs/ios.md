# iOS 佈線（於 macOS 開發）

iOS 需在 macOS 上以 Xcode 建置。`aqutter init` 的範本已含 `ios/`，以下設定**皆已由範本設定好**；本文說明各項內容與原因，客製或除錯時參照。

## 1. App Transport Security（本機 shelf server 為 http）

`ios/Runner/Info.plist` 已由範本設定好，允許 loopback cleartext：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

> `NSAllowsLocalNetworking` 專門放行 loopback / 私有網段，不影響對外 https 的 ATS。dev 連 PC IP 的 dev server 亦被涵蓋。

## 2. 權限 usage description（`Info.plist`）

範本已含下列描述鍵（permission_plus 會讀取），文字請改成自己的用途說明，並依實際用到的能力增減：

```xml
<key>NSCameraUsageDescription</key><string>需要相機以…</string>
<key>NSMicrophoneUsageDescription</key><string>需要麥克風以…</string>
<key>NSLocationWhenInUseUsageDescription</key><string>需要定位以…</string>
<key>NSLocalNetworkUsageDescription</key><string>需要本地網路以連線印表機</string>
```

**缺少對應的鍵時，系統在該權限被請求的當下會直接終止 app。** 專案已完全改用 SPM（無 `Podfile`）；`permission_plus_apple` 提供 `Package.swift`，且**不會**讀取 `Info.plist`——前身 `permission_handler` 曾把這些鍵當成 `PERMISSION_*` 編譯開關，換套件後不再有「刪鍵就靜默停用」的行為，也不必為此清 DerivedData。

## 3. In-App Browser（SFSafariViewController）

`aqutter_core` 的 `AqutterChromeSafariBrowser` 於 iOS 自動使用 SFSafariViewController，無額外佈線。

## 4. 背景執行（本期僅預留）

iOS 背景限制較嚴：對應 `BGTaskScheduler`（`workmanager` 有封裝）。需在 `Info.plist` 宣告 `BGTaskSchedulerPermittedIdentifiers` 與背景模式，日後另開計畫實作。

## 5. 建置

```bash
aqutter seed                 # 產生 <appDir>/assets/seed/web-bundle.zip（網頁框架靜態輸出）
aqutter build ios            # 或 aqutter dev ios
```

## 6. 本機通知與深層連結

殼內建本機通知與深層連結。通知不需要改原生專案（通知代理由殼自己設定）；深層連結要在 `Info.plist` 宣告 scheme，Universal Links 另需 Associated Domains。設定與範例見[內建原生功能](native-features.md)。
