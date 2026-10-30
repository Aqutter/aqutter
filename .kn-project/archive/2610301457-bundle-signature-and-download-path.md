# 2610301457-bundle-signature-and-download-path

- Created: 2026-10-30 14:57 / Archived: 2026-10-30 15:25
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
殼可以在編譯期內置 Ed25519 公鑰，只接受用私鑰簽過的網頁包，並修掉 `download` handler 的檔名路徑穿越。
目的：網頁包只有 sha256（與 zip 同源）擋不住更新伺服器被入侵，而網頁包能直接執行並呼叫 bridge；`download` 的 `fileName` 原本直接接在文件目錄後面。影響 `aqutter` 殼的更新與 bridge、文件與 wiki；簽署端在 `aqutter-cli` 的同名計畫。

## Cross-Repo Scope
- **共用計畫 ID**: `2610301457-bundle-signature-and-download-path`（無共用分支，直接 main）
- `aqutter` — 驗證端：下載檔名驗證、網頁包簽章驗證、文件與 wiki。契約正本 repo。
- `aqutter-cli` — 簽署端：`bundle keygen`／`bundle sign`、env 範本。
- 執行順序：契約凍結後兩邊平行；以共同的 RFC 8032 測試向量各自驗證，最後以 CLI 實際簽出的包交給殼驗證。

## 契約（只留引用）
`aqutter` repo 的 `docs/hot-update.md`「簽章」一節為正本；最終修訂號 rev 1（2026-10-30 凍結，之後無變更）。要點：Ed25519；簽章訊息 `aqutter-bundle-v1\n{version}\n{sha256 小寫}\n`；`version.json` 新增選填 `signature`；編譯期公鑰 `AQUTTER_UPDATE_PUBLIC_KEYS`（逗號分隔多把、網頁不可改）；設了公鑰才強制，缺任一項或驗證不過就拒絕並保留現行網頁包。

## Key Decisions
- **[範圍]** 路徑驗證＋網頁包簽章；APK 簽章與安全儲存不做 — APK 換包由 Android 簽章比對擋下；安全儲存依賴重，依「殼要小」另案做成 plugin。
- **[策略]** 設了公鑰才強制，未設維持現行 — 不破壞既有 App；要升級的人在編譯期明確開啟。
- **[演算法]** Ed25519、訊息含版本與雜湊、支援多把公鑰 — 簽章短、實作簡單；綁版本防舊包貼新號；多把供輪替。
- **[私鑰]** 私鑰只存在簽署端，殼只有公鑰 — 網頁包可執行，簽署權限不可進 App。
- **[套件]** Dart 端用純 Dart 的 `cryptography ^2.9.0`，不引入平台原生程式碼 — 殼要小、各平台一致。
- **[流程]** 直接 main、不建 issue；契約 rev 1 凍結；完成後只 commit，push 與 tag 依使用者要求。
- **[執行中]** 公鑰 env 的讀取放在 `bundle_signature.dart`，不放 `update_config.dart` — `BundleUpdateConfig` 是網頁可經 `update_config_set` 覆寫的設定物件，獨立後只有編譯期常數一條來源。契約不變。
- **[執行中]** 驗證邏輯抽成 `verifyBundleBytes`（`@visibleForTesting`），原 `_verifyHash` 刪除 — `download` 依賴檔案系統與 Dio，抽出後策略表可直接測。
- **[執行中]** `download` 檔名不合法時回 `aqutterError`（`invalid_file_name`）— 沿用 plugin 既有的錯誤資料轉換。

## Deviations
- 公鑰 env 的讀取與解析放在 `bundle_signature.dart`，未動 `update_config.dart`（見 Key Decisions，契約不變）。
- 實機（Android）以設公鑰的 release APK 驗證：無簽章、錯金鑰簽章、重放（改大版本號）皆被拒、版本不變；正確簽章被接受並套用。Windows／iOS／macOS／Linux 沒有實機驗證。
- 簽章 env 的 wiki 環境頁因生成來源（`docs/env.example`）新增一鍵而重新生成。

## Impact Files
- `shell/lib/src/bridge/bridge_registry.dart:361`（`_registerDownload`）— 組路徑前先驗證檔名
- `shell/lib/src/bridge/safe_file_name.dart`（new）— 下載檔名驗證
- `shell/lib/src/server/bundle_manager.dart`（`RemoteVersion.signature`、`verifyBundleBytes`、`download`）— 解包前驗證
- `shell/lib/src/server/bundle_signature.dart`（new）— Ed25519 驗證、公鑰解析、訊息組裝、編譯期 env
- `shell/lib/src/app.dart:161`、`:326` — `_bundleManager` 改為在 `_bootstrap` 內建構並傳入驗證器
- `shell/pubspec.yaml:57` — 新增 `cryptography`
- `shell/test/bundle_signature_test.dart`（new）、`shell/test/safe_file_name_test.dart`（new）
- `docs/hot-update.md`、`docs/environment.md`、`docs/env.example` — 簽章說明與新 env 鍵
- `.kn-project/wiki/platform/update-signature.md`（new）、`environment.md`、`index.md`
- `manifest/releases.json` — shell ref 指向簽章驗證 commit（chore 另一個 commit）

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/update-signature.md` | 2026-10-30 | — | 殼可內置公鑰驗證網頁包簽章並修掉下載檔名路徑穿越 | — | — |
