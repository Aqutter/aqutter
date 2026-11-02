# 2610301536 - builtin-clipboard-share-notify-deeplink

- Created: 2026-10-30 15:36 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼內建了剪貼簿（文字與圖片）、系統分享（文字、網址、檔案）、本機通知與深層連結四個原生能力，圖片剪貼簿與本機通知由殼套件自己的原生程式實作，不依賴外部套件。
目的是讓網頁不必另外安裝 plugin 就能用最常需要的原生能力；過程中因 Windows 建置會被通知套件拉進 ATL 相依，把本機通知從外部套件改成自己實作（Iteration 1）。本計畫完成後，這些能力又被計畫 `2610310119-shell-kotlin-and-feature-plugins` 重組為殼內建的 `AqutterPlugin`，handler 與事件名稱因此改變，原生程式改為 Kotlin。

## Cross-Repo Scope
- **共用計畫 ID**: `2610301536-builtin-clipboard-share-notify-deeplink`；無共用分支，各 repo 直接 `main`。
- `aqutter` — 殼端實作與契約正本（本 repo）。
- `aqutter-js` — 契約型別與名稱（已歸檔於該 repo）。
- `aqutter-cli` — 範本設定；Iteration 1 後無淨變更（已歸檔於該 repo）。
- 執行順序：契約凍結後三者平行；`aqutter-js` 先推送並移動 tag，再更新本 repo 的 manifest。

## 契約（只留引用）
契約的歷史版本如下，現行契約以 `docs/native-features.md` 為準，且已被 `2610310119` 的內建 plugin 契約取代（名稱改為 `<id>.<method>`）：
- rev 1：八個 handler（剪貼簿讀寫、分享、通知顯示／排程／取消／冷啟資訊、啟動連結）與兩個事件；通知與連結只在 Android、iOS、macOS。
- rev 2：`share_open` 新增選填 `files`（最多 5 個、每個 ≤ 5 MiB）；新增 `clipboard_read_image`／`clipboard_write_image`（PNG、JPEG，≤ 5 MiB）；錯誤碼 `too_large`。
- rev 3：新增 Android 重開機後重新排程尚未到時間的通知的行為說明，handler 與欄位不變。

## Key Decisions
- **[範圍]** 剪貼簿、分享、本機通知、深層連結；推播、生物辨識、安全儲存不做 — 先做不需要外部服務的常用能力（使用者決議）。
- **[位置]** 內建在殼的 bridge，不做成 plugin — 使用者決議；代價是每個 App 都帶這些相依。（之後由 `2610310119` 改為內建 plugin。）
- **[排程]** 非精確排程、以絕對時間點 — 避免精確鬧鐘權限與時區相依。
- **[權限]** 通知不自動跳授權 — 權限一律經殼既有的權限 handler。
- **[啟動連結與冷啟點擊]** 只由網頁主動讀取，不走事件 — 事件在網頁未連線時會被丟棄，冷啟必須有可重複讀取的來源。
- **[分享檔案]** 沿用已在用的 `share_plus`；文字與網址同時給時合成一段文字（`share_plus` 不允許 text 與 uri 並存）。
- **[圖片剪貼簿]** 框架自己實作、不引入外部套件（使用者決議）：殼套件本身宣告為 Flutter plugin，含 Android、iOS、macOS、Windows 的原生程式，Linux 不做。
- **[本機通知自己實作（Iteration 1）]** 移除 `flutter_local_notifications` 與 `timezone` — 它的 Windows 實作需要 Visual Studio 的 ATL，會讓所有 Windows App 多一個建置相依，而我們的契約本來就不支援 Windows 通知（使用者決議）。
- **[重開機後（Android）]** 尚未到時間的排程通知重新排上，已過時間的不補發；殼自己宣告 `RECEIVE_BOOT_COMPLETED` — 使用者選擇。
- **[pubspec 純 ASCII]** 殼的 `pubspec.yaml` 不放多位元組字元 — Windows 上的 pub 以系統碼頁讀 `git show` 的輸出，中文註解會讓 git 相依解析失敗。
- **[流程]** 直接 main、不建 issue；完成後只 commit，push 與移動 tag 依使用者要求。

## Deviations
- **中途改實作（Iteration 1）**：先以 `flutter_local_notifications` 完成通知並實機驗證，發現它拉進 ATL 與其排程在實機不出現後，改為自己實作；先前加到 `aqutter-cli` 範本的去糖與通知代理設定因此還原。
- **兩個實機才發現的問題**：App 被殺掉後點通知，Android 先用原本的啟動 Intent 重建畫面再以 `onNewIntent` 送來點擊，Dart 還沒就緒，改為把就緒前收到的點擊記成冷啟資訊；`pubspec.yaml` 的中文註解造成 Windows 上 git 相依解析失敗。
- **契約 rev 2 與 rev 3** 在核准後的執行中追加（Rule 29），並於各 repo 的計畫同步。
- **驗證範圍**：Android 實機驗證了剪貼簿圖片往返、分享圖片、通知顯示／排程／取消／兩種點擊、深層連結（執行中與冷啟）；Windows 以小程式驗證圖片剪貼簿並完成完整建置。**未驗證**：Android 重開機後重新排程、iOS 與 macOS 的圖片剪貼簿與通知（沒有裝置可編譯）。
- 本計畫之後由 `2610310119` 重組為內建 plugin，檔案位置與名稱已改變；下方 Impact Files 為當時的位置。

## Impact Files
- `shell/lib/src/bridge/bridge_names.dart`、`bridge_registry.dart` — 新增 handler 與事件、註冊（已被 `2610310119` 取代）
- `shell/lib/src/bridge/native_features.dart`、`notification_service.dart`、`deep_link_service.dart`、`share_files.dart`、`clipboard_image_service.dart`（皆 new）— 驗證與服務（已搬到 `shell/lib/src/plugins/`）
- `shell/android/`、`shell/darwin/`、`shell/windows/`（皆 new）— 殼套件的原生程式（圖片剪貼簿、本機通知）；Android 其後改為 Kotlin
- `shell/pubspec.yaml` — 殼套件宣告為 plugin；新增 `share_plus`、`app_links`；移除 `flutter_local_notifications`、`timezone`
- `shell/test/` — 驗證、通知服務、深層連結、分享與圖片剪貼簿、通道對應的測試
- `docs/native-features.md`、`docs/android.md`、`docs/ios.md` — 用法與原生設定
- `.kn-project/wiki/platform/native-features.md`（new）、`index.md`
- `manifest/releases.json` — shell ref 與 client spec 跟版

## Wiki Changes

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/native-features.md` | 2026-11-02 | — | 殼內建剪貼簿、分享、本機通知與深層連結，圖片剪貼簿與通知由自己的原生程式實作 | — | — |
