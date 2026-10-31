# Tasks for 2610310119

## Phase 1 — Android 原生轉 Kotlin（Gradle 風險最高，先驗證）
- [x] [aqutter] 寫入 `AGENTS.md` 紅線：Android 原生一律 Kotlin、Apple 一律 Swift
- [x] [aqutter] 改 `shell/android/build.gradle.kts`：AGP 9.3.0、`kotlin { compilerOptions { jvmTarget = JVM_17 } }`、移除「純 Java」註解
- [x] [aqutter] 先放一個空的 Kotlin 檔，在範本專案（`aqutter-nuxt-app/aqutter`）跑 `flutter build apk --debug` 確認 Gradle 設定可用，再繼續
- [x] [aqutter] 轉換 `AqutterClipboardProvider`、`AqutterBootReceiver`、`AqutterNotificationReceiver`
- [x] [aqutter] 轉換 `AqutterNotifications`（321 行）
- [x] [aqutter] 轉換 `AqutterShellPlugin`（221 行），刪除 `src/main/java`
- [x] [aqutter] 確認 `AndroidManifest.xml`、`pubspec.yaml` 的類別名仍正確
- [x] [aqutter] 驗證：`flutter build apk --debug` 與 `--release`（R8 規則已保留 `com.github.aqutter.**`、`kotlin.**`，仍需實測）

## Phase 2 — `AqutterPlugin` 逐方法平台（Contract §4）　可平行（與 aqutter-js 的 Phase 1）
- [x] [aqutter] `aqutter_plugin.dart` 新增 `supportedPlatformsFor(String method)`，預設沿用 `supportedPlatforms`
- [x] [aqutter] `aqutterPluginSupports` 與 `_registerPlugins` 改以方法為單位判斷；`attach` 只在至少支援一個方法的平台呼叫
- [x] [aqutter] `test/plugin_test.dart` 補測試：預設行為不變、逐方法覆寫、不支援方法仍註冊但不列入能力表並回 `UNSUPPORTED_PLATFORM`

## Phase 3 — 四個功能搬成內建 plugin（依賴 Contract §1；每搬一個跑 `flutter analyze && flutter test`）
- [ ] [aqutter] 建 `plugins/builtin_plugins.dart` 與 `plugins/_shared/`（搬 `native_features.dart`），`BridgeRegistry` 的 plugin 清單 = 內建四個 + App 傳入
- [ ] [aqutter] 搬 `share`（`share.open`、`share_files.dart`）
- [ ] [aqutter] 搬 `clipboard`（四個方法，圖片方法逐方法平台宣告）
- [ ] [aqutter] 搬 `deeplink`（`deeplink.initial`、`deeplink.received`）
- [ ] [aqutter] 搬 `notification`（四個方法、`notification.tapped`）
- [ ] [aqutter] 刪除 `bridge_names.dart` 的 10 個 handler 與 2 個事件常數，`BridgeRegistry` 刪除 `_registerNativeFeatures`、`_startNativeServices`、服務欄位與 import
- [ ] [aqutter] 能力表比對測試：新名稱與支援平台逐項符合 Contract §1
- [ ] [aqutter] 冷啟測試：`initial` 與事件的啟動時機、只啟動一次
- [ ] [aqutter] 測試補一條：第三方 plugin 取名 `share` 等保留 id 會丟 `ArgumentError`

## Phase 4 — 原生按功能分資料夾
- [ ] [aqutter] Android 分 Kotlin 子套件 `clipboard`、`notification`，同步 `AndroidManifest.xml`，確認 R8 規則仍涵蓋
- [ ] [aqutter] Apple：`AqutterNotifications.swift` 移到 `Notifications/`，確認 `Package.swift` 與 podspec 涵蓋
- [ ] [aqutter] 驗證：`flutter build apk --debug`、`flutter build macos`、`flutter build ios --no-codesign`

## Phase 5 — 文件與整體驗證
- [ ] [aqutter] 同步 `docs/native-features.md`（`callPlugin` 範例與新舊名稱對照表）、`docs/plugins.md`、`docs/android.md`、`shell/README.md`、`.kn-project/project.md`、`AGENTS.md` 紅線 2
- [ ] [aqutter] `cd shell && flutter analyze && flutter test`
- [ ] [aqutter] 需等待 [aqutter-js]：型別與契約 rev 1 完成並 commit → 更新 `manifest/releases.json`（合併後，見 Manual Follow-ups）
- [ ] [aqutter] 需等待 [aqutter-nuxt-app]：跟版完成 → 在範例 App 上跑 Native features 頁：剪貼簿文字與圖片、分享、通知（即時與排程）、深層連結
- [ ] [aqutter] 回報未驗證項目（實體裝置重開機重排、點通知冷啟）
