<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610310119 - shell-kotlin-and-feature-plugins
- Created: 2026-10-31
- Branch: feature/2610310119-shell-kotlin-and-feature-plugins
- Issue: Aqutter/aqutter#43
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
1. **殼的 Android 原生一律改用 Kotlin**：`shell/android/` 的 5 個 Java 檔（603 行）全部轉成 Kotlin，Gradle 改為 AGP 9 內建 Kotlin，並把「原生一律 Kotlin」寫進 `AGENTS.md`。iOS／macOS 已是 Swift，只做資料夾整理。
2. **內建原生功能改成真正的內建 plugin**：剪貼簿（文字＋圖片）、分享、本機通知、深層連結各自成為 `AqutterPlugin` 子類，放在 `shell/lib/src/plugins/<功能>/`（`clipboard`、`share`、`notification`、`deeplink`），handler 名稱改為 `<id>.<method>`、事件頻道改為 `<id>.<event>`（契約 rev 1）。`BridgeRegistry` 只負責收集與註冊。
3. **移除舊的內建名稱（breaking，開發階段 `0.0.0`）**：`bridge_names.dart` 中這四組功能的 10 個 handler 與 2 個事件常數刪除，不留別名；網頁端同步改用 `callPlugin`／`onPluginEvent`／`isPluginSupported`。
4. **`AqutterPlugin` 支援逐方法宣告平台**：讓 `clipboard.readImage`／`writeImage` 在 Linux 不列入能力表，其餘方法不受影響（第三方 plugin 同樣可用，既有寫法不受影響）。
5. 原生程式碼（Android Kotlin 子套件、Swift 子資料夾）也按功能分區。

## Architecture
**現況**：內建功能的 handler 全在 `BridgeRegistry._registerNativeFeatures()`（`shell/lib/src/bridge/bridge_registry.dart:798`），服務散在 `lib/src/bridge/`；plugin 走 `AqutterPlugin`（`handlers`、`attach`、`dispose`，`shell/lib/src/plugin/aqutter_plugin.dart:88`），`_registerPlugins()`（`bridge_registry.dart:185`）以 `<id>.<method>` 組名並用 `aqutterPluginSupports`（`aqutter_plugin.dart:55`）決定是否列入能力表。兩條路最後都經 `_handle(name, fn)` 註冊到同一個 RPC。

**目標**：
```
shell/lib/src/plugins/
  clipboard/    clipboard_plugin.dart  clipboard_image_service.dart
  share/        share_plugin.dart  share_files.dart
  deeplink/     deeplink_plugin.dart  deep_link_service.dart
  notification/ notification_plugin.dart  notification_service.dart
  _shared/      native_features.dart（參數驗證與共用型別）
  builtin_plugins.dart   （回傳四個內建 plugin 的清單）
shell/android/src/main/kotlin/com/github/aqutter/shell/
  AqutterShellPlugin.kt   （Flutter plugin 入口，單一，委派給各功能）
  clipboard/    AqutterClipboardProvider.kt …
  notification/ AqutterNotifications.kt  AqutterNotificationReceiver.kt  AqutterBootReceiver.kt
shell/darwin/aqutter/Sources/aqutter/
  AqutterShellPlugin.swift
  Notifications/AqutterNotifications.swift
```
- `BridgeRegistry` 的 plugin 清單 = 內建四個 + App 傳入的 plugin。既有的「id 不得重複」檢查使第三方 plugin 若取名 `clipboard`／`share`／`notification`／`deeplink` 會在組裝期丟 `ArgumentError`（行為後果，記入文件）。
- **逐方法平台**：`AqutterPlugin` 新增選填 `Set<TargetPlatform>? supportedPlatformsFor(String method)`，預設回傳 `supportedPlatforms`；`aqutterPluginSupports` 與 `_registerPlugins` 改以方法為單位判斷；「不支援時仍註冊、不列入能力表、呼叫回 `UNSUPPORTED_PLATFORM`」的語意不變。`attach` 只在 plugin 層至少支援一個方法的平台呼叫。
- **冷啟與事件**：`notification.initial`／`deeplink.initial` 與兩個事件的啟動時機、「服務只啟動一次」語意不變；改由各 plugin 的 `attach` 啟動，並以既有 service 測試加冷啟測試守住。
- **MethodChannel 名稱不變**（`com.github.aqutter/clipboard`、`com.github.aqutter/notifications`）：它們是殼 Dart 與殼原生之間的內部通道，不屬於網頁契約。
- **Kotlin／Gradle**：依 `aqutter_core` 先例（AGP 9.3.0 內建 Kotlin、不另套 Kotlin 外掛、`kotlin { compilerOptions { jvmTarget = JVM_17 } }`、原始碼在 `src/main/kotlin`）。
- **實作順序**：Phase 1 Kotlin（Gradle 風險最高，先驗證）→ Phase 2 `AqutterPlugin` 逐方法平台 → Phase 3 四個功能逐一搬成內建 plugin（每個跑一次測試）→ Phase 4 原生分區 → Phase 5 文件與整體驗證。
- 實作遵守 `kn-project-code-style` 技能規範（Dart、Kotlin、Swift 各依其語言層）；Phase 3 執行前先載入。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter`（契約正本 repo、提供方）
- **共用計畫 ID**: `2610310119-shell-kotlin-and-feature-plugins`　**共用分支名**: `feature/2610310119-shell-kotlin-and-feature-plugins`（`aqutter-js`、`aqutter-nuxt-app` 的 project.md 規定開發階段直接推 `main`，其計畫的 Branch 為 N/A，沿用既有慣例；本 repo 是否建分支於核准閘決定）
- **參與 repo 與職責**（Rule 20：一 repo 一 issue；`aqutter-js`、`aqutter-nuxt-app` 依其 project.md 不建 issue）:
  - `aqutter` — 殼：Kotlin 轉換、內建 plugin 化、`AqutterPlugin` 逐方法平台、移除舊名稱、更新 manifest；issue: `Aqutter/aqutter#43`
  - `aqutter-js` — 網頁端 client：移除舊 `BridgeHandler`／`BridgeEvent` 項目與對應型別表，新增四個內建 plugin 的 `PluginDefinition` 型別；issue: `N/A`
  - `aqutter-nuxt-app` — 範例 App：改用 `callPlugin`／`onPluginEvent`／`isPluginSupported`，並用 `aqutter upgrade` 跟版；issue: `N/A`
- **執行順序相依**: 契約 rev 1 凍結後，`aqutter` 與 `aqutter-js` 可平行；兩者都完成並各自 commit 後，`aqutter` 更新 `manifest/releases.json`（`shell` ref 與 `client.spec` 為各自的 commit sha）；最後 `aqutter-nuxt-app` 跟版並驗證。**不得讓半套契約落地。**
- **跨 repo 檔案指涉**: `aqutter-js`：`src/contract/bridge.ts`、`src/contract/table.ts`、`src/index.ts`；`aqutter-nuxt-app`：`app/composables/Native/useNativeFeatures.ts`、`app/pages/native.vue`。`aqutter-cli` 與 `aqutter-plugin-*` 經 Phase 0 搜尋無引用，不在範圍。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-10-31）`

### 1. 方法與事件
內建 plugin 採一般 plugin 命名規則：handler `<id>.<method>`、事件頻道 `<id>.<event>`；網頁以 `callPlugin(id, method, payload)`、`onPluginEvent(id, event, listener)`、`isPluginSupported(id, method)` 使用。**舊名稱全部移除，不留別名。**

| # | 新方法 | 取代的舊 handler | 請求型別 | 回應型別 | 支援平台 |
|---|---|---|---|---|---|
| 1 | `clipboard.read` | `clipboard_read` | `NoPayload` | `ClipboardReadResponse` | 全部 |
| 2 | `clipboard.write` | `clipboard_write` | `ClipboardWriteRequest` | `OkResponse` | 全部 |
| 3 | `clipboard.readImage` | `clipboard_read_image` | `NoPayload` | `ClipboardReadImageResponse` | Android、iOS、macOS、Windows |
| 4 | `clipboard.writeImage` | `clipboard_write_image` | `ClipboardWriteImageRequest` | `OkResponse` | Android、iOS、macOS、Windows |
| 5 | `share.open` | `share_open` | `ShareOpenRequest` | `ShareOpenResponse` | 全部 |
| 6 | `notification.show` | `notify_show` | `NotifyShowRequest` | `NotifyIdResponse` | Android、iOS、macOS |
| 7 | `notification.schedule` | `notify_schedule` | `NotifyScheduleRequest` | `NotifyIdResponse` | Android、iOS、macOS |
| 8 | `notification.cancel` | `notify_cancel` | `NotifyCancelRequest` | `OkResponse` | Android、iOS、macOS |
| 9 | `notification.initial` | `notify_initial` | `NoPayload` | `NotifyInitialResponse` | Android、iOS、macOS |
| 10 | `deeplink.initial` | `deeplink_initial` | `NoPayload` | `DeeplinkInitialResponse` | Android、iOS、macOS |

| 事件頻道 | 取代的舊事件 | payload 型別 | 平台 |
|---|---|---|---|
| `notification.tapped` | `notify_tapped` | `NotifyTappedPayload` | Android、iOS、macOS |
| `deeplink.received` | `deep_link` | `DeepLinkPayload` | Android、iOS、macOS |

### 2. 請求與回應欄位
欄位、型別、可空、預設值、單位與限制**全部沿用 rev 2，不變**：型別正本是 `aqutter-js` 的 `src/contract/bridge.ts:355-456`（型別名稱如上表），數值限制（文字 ≤ 1,000,000 字、圖片與分享檔案 ≤ 5 MiB／5,242,880 位元組、分享最多 5 個檔案、`name` 為單一檔名且 ≤ 128 字）見 `docs/native-features.md`。本修訂只改名稱，不改任何欄位。

### 3. 錯誤碼
沿用 rev 2，不新增、不刪除：`invalid_argument`（參數驗證失敗，含 MIME 與位元組不符）、`too_large`（圖片超過 5,242,880 位元組，僅 `clipboard.readImage`）、`permission_denied`（通知未授權，僅 `notification.show`／`schedule`）、`UNSUPPORTED_PLATFORM`（本平台不支援該方法）。

### 4. 狀態與規則
- 能力表（`platform_info.capabilities`）內的名稱為 `<id>.<method>`；方法在本平台不支援時：仍註冊、不列入能力表、呼叫回 `UNSUPPORTED_PLATFORM`。網頁以 `isPluginSupported(id, method)` 查詢；能力表尚未取得時視為支援。
- 內建 plugin id 為 `clipboard`、`share`、`notification`、`deeplink`，使用者 plugin 不得同名（組裝期丟 `ArgumentError`）。
- 事件在網頁未連線時丟棄；啟動 App 的通知與連結只由 `notification.initial`／`deeplink.initial` 取得，不走事件。通知與深層連結服務只啟動一次，WebView 重掛不重複訂閱。
- 殼與網頁之間的 RPC 傳輸、二進位酬載（`Uint8List`／`Uint8Array`）規則不變。

### 5. 相容性
- **breaking**：`BridgeHandler` 的 `ClipboardRead`…`DeeplinkInitial`（10 項）與 `BridgeEvent` 的 `NotifyTapped`、`DeepLink` 移除，舊名稱呼叫會失敗。理由：目前為開發階段版本 `0.0.0`，沒有已發佈的相依者；已知的使用端只有 `aqutter-nuxt-app`。
- 殼內部的 MethodChannel 名稱與 Android／iOS 原生行為不變。
- 其餘 `BridgeHandler`／`BridgeEvent`（平台、儲存、下載、日誌…）完全不動。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
Phase 0 Code Evidence Scan 取得的錨點（路徑相對 repo root）：
- `shell/android/build.gradle.kts:1` — 註解與設定寫明「純 Java，不依賴 Kotlin 外掛」；改為 AGP 9.3.0 內建 Kotlin（現為 AGP 8.12.1 classpath）。
- `shell/android/src/main/java/com/github/aqutter/shell/AqutterShellPlugin.java:37` (`AqutterShellPlugin`) — 入口，221 行，`readImage`／`writeImage`（:106、:109）；轉 Kotlin 並移到 `src/main/kotlin`。
- `shell/android/src/main/java/com/github/aqutter/shell/AqutterNotifications.java:41` (`AqutterNotifications`) — 321 行；轉 Kotlin。
- `shell/android/src/main/java/com/github/aqutter/shell/AqutterNotificationReceiver.java:9`、`AqutterBootReceiver.java:9`、`AqutterClipboardProvider.java:6` — 轉 Kotlin。
- `shell/android/src/main/AndroidManifest.xml:10` — `provider`／`receiver` 以完整類別名引用；分子套件時同步。
- `shell/android/src/main/res/xml/aqutter_clipboard_paths.xml` — 路徑白名單，位置不變，僅確認引用。
- `shell/pubspec.yaml:76` (`flutter.plugin.platforms.android`) — 入口類別名預期維持 `com.github.aqutter.shell.AqutterShellPlugin`。
- `shell/lib/src/plugin/aqutter_plugin.dart:55` (`aqutterPluginSupports`)、`:88` (`AqutterPlugin`)、`:100` (`supportedPlatforms`) — 新增逐方法平台宣告。
- `shell/lib/src/bridge/bridge_registry.dart:185` (`_registerPlugins`) — 改為逐方法判斷支援；`:798` (`_registerNativeFeatures`)、`:859` (`_startNativeServices`)、`:101-103`（服務建構）、`:167-173`（註冊順序）— 抽出並刪除，改為內建 plugin 清單 + App plugin。
- `shell/lib/src/bridge/bridge_names.dart:102-116`、`:166-169` — 刪除 10 個 handler 與 2 個事件常數（契約 rev 1，與 `aqutter-js` 成對）。
- `shell/lib/src/bridge/notification_service.dart`、`deep_link_service.dart`、`clipboard_image_service.dart`、`share_files.dart`、`native_features.dart` — 搬到 `plugins/<功能>/` 與 `plugins/_shared/`。
- `shell/test/platform_local_notifier_test.dart:1`、`deep_link_service_test.dart:3`、`native_features_validation_test.dart:1`、`share_and_clipboard_image_test.dart:4-6`、`notification_service_test.dart:1-2` — import 路徑隨搬移更新；`shell/test/plugin_test.dart` 補逐方法平台測試。
- `shell/darwin/aqutter/Sources/aqutter/AqutterNotifications.swift` — 搬到 `Notifications/`，確認 `Package.swift` 與 podspec 涵蓋。
- `manifest/releases.json:23-24` (`client.spec`) 與 `shell` ref — 兩個 repo 完成後更新為各自的 commit sha（見 Manual Follow-ups）。
- `AGENTS.md` — 新增紅線「原生程式一律 Kotlin（Android）／Swift（Apple）」，並更新紅線 2 對內建名稱的描述。
- `docs/native-features.md`、`docs/plugins.md`、`docs/android.md`、`shell/README.md` — 範例由 `callFlutter` 改為 `callPlugin`，並說明內建 plugin id 保留與原生語言；僅在內容提及時修改。
- `.kn-project/project.md` — 補一句內建功能的組織方式；`.kn-project/wiki/platform/native-features.md` — 由 `kn-project-wikification` 在 Phase 5 同步。
- `shell/lib/src/plugins/**`、`shell/android/src/main/kotlin/com/github/aqutter/shell/**` (new) — 內建 plugin 與轉換後的 Kotlin 檔。

## App-Flow Screens
（本專案無 `.kn-project/app-flow.json`，刪除本節。）

## Open Questions / 待確認事項
無（Q1–Q4 已全部確認，見 Key Decisions）。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 更新 `manifest/releases.json` 的 `shell` ref 與 `client.spec` 為兩個 repo 合併後的 commit sha，並把 git tag `0.0.0` 移到最新 `main` — 依 `AGENTS.md`「工作流程」與 `docs/releases.md` — ref 必須是合併後才存在的 sha，tag 為對外可見操作
- **[合併後]** 在實機驗證 Android 本機通知（排程、重開機後重排、點通知冷啟）與剪貼簿圖片貼上 — 用 `aqutter-nuxt-app` 的 Native features 頁 — agent 無法操作實體裝置的重開機與系統通知列
- **[合併後]** 其他使用內建名稱的 App 要改用新名稱 — 依 `docs/native-features.md` 的對照表 — 屬 breaking change，agent 不知道還有哪些外部 App

## Key Decisions
- **[Phase 0]** Milestone：不指定，`${BASE_BRANCH}` = `main` — 理由：`.kn-project/project.md` 寫明開發階段直接用 main、不開 milestone 與版本分支；tag 與 `shell/pubspec.yaml:4` 皆為 `0.0.0`。
- **[Phase 0]** 整合主幹：遠端只有 `main` 與 `chore/post-unified-transport-refs`，無 dev 類分支，採 `origin/HEAD`（`main`），不詢問。
- **[Phase 0]** 不詢問 App-Flow：本計畫為殼內重構與契約改名，不觸及畫面。
- **[Phase 1]** 不拆分：Kotlin 轉換與內建 plugin 重組有檔案重疊（原生按功能分資料夾），且後者依賴前者，不符 Rule 22 兩項提升條件，留作 Phase。跨 repo 依 Rule 19 分三份計畫。
- **[Q1]** Gradle 照 `aqutter_core`：AGP 9.3.0 內建 Kotlin、不套 Kotlin 外掛 — 理由：範本專案已用 AGP 9.3.1，框架內做法一致。
- **[Q2]** 強制內建功能改走 plugin 的 `<id>.<method>`，不留舊名稱 — 理由：使用者要求統一寫法，且目前為 `0.0.0` 沒有已發佈相依者。連帶效果：本計畫成為跨 repo。
- **[舊計畫]** 先歸檔 `aqutter-js`、`aqutter-cli` 的 `2610301536-builtin-clipboard-share-notify-deeplink`（已在本地 commit：`4d717c2`、`a863134`，未 push）再開本計畫 — 理由：避免與未歸檔計畫牴觸同一份契約。
- **[契約]** 名稱依提案：四個 plugin id、事件為 `notification.tapped`、`deeplink.received` — 理由：使用者確認。
- **[Q3]** 原生按功能分資料夾（Android Kotlin 子套件、Swift 子資料夾），共用驗證放 `plugins/_shared/` — 理由：使用者確認。
- **[Q4]** `AqutterPlugin` 新增逐方法平台宣告（預設沿用 plugin 層），不拆 `clipboard-image` — 理由：維持單一 `clipboard` plugin 與契約名稱。
- **[記憶]** 使用者另要求未來把外部 plugin 與 plugin 範本的 Android 也轉 Kotlin，本計畫不處理，另案規劃。

- **[契約]** rev 1 凍結（核准日 2026-10-31）— 理由：使用者核准三份計畫的契約。
- **[流程]** 本 repo 建分支＋建 issue＋PR（完成後：commit + 開 PR，預設；完成時會 `git fetch` 後 `git rebase origin/main` 並 `git push --force-with-lease --force-if-includes`，重寫遠端工作分支歷史）— 理由：使用者選擇；5 個 Phase 的工作量適合走 PR。
- **[執行模式]** 序列 — 依據：三個 repo 有相依（manifest 與跟版要等另外兩者的 commit），且本環境以單一對話逐 repo 實作最可控；順序為 aqutter-js → aqutter → aqutter-nuxt-app。
- **[限制]** `aqutter-nuxt-app` 的跟版（`aqutter upgrade`）需要 manifest 指向已推送的 commit sha，故其程式碼改動可先完成，跟版與端到端驗證要等 aqutter-js 與 aqutter 推送／合併之後。

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base，不依賴 `gh` 的預設值 (Rule 23)。
- Issue 綁定時，每個 commit 訊息與 PR body 都必須含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`，不是 `${ID}`）。歸檔完成後於該 issue 張貼由 archive 蒸餾的結案留言 (Rule 20)。
- Issue 的關閉發生在合併後清理（使用者回報已合併、內容驗證通過），不在歸檔當下 (Rule 21 步驟 6)。
- commit 一律自動（Rule 17）。完成時依核准閘的「完成後」選項：選 push 或 PR 才會 `git fetch` 後 `git rebase origin/main` 並更新遠端工作分支（`git push --force-with-lease --force-if-includes`）；選只 commit 則兩者都不做。
- PR/archive order: Archive automatically triggered on PR request
- 跨 repo 時，本 repo 自己開自己的 PR；不存在橫跨多 repo 的單一 PR。建議合併次序：`aqutter-js` 與 `aqutter` 任意先後，兩者合併後更新 manifest，最後 `aqutter-nuxt-app` 跟版。

## References
- 無外部 issue；起因為對話中對「內建功能是否與 plugin 同一寫法」與「原生一律 Kotlin」的討論。
- 先例：`aqutter_core` 的 Android Gradle 設定（AGP 9.3.0、Kotlin 內建）；`.kn-project/archive/2610271520-split-db-into-plugin.md`（資料庫從內建 handler 拆成 plugin）。
- 前置歸檔：`aqutter-js` 與 `aqutter-cli` 的 `.kn-project/archive/2610301536-builtin-clipboard-share-notify-deeplink.md`。
