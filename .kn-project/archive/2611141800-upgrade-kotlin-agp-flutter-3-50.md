# 2611141800-upgrade-kotlin-agp-flutter-3-50

- Created: 2026-11-14 18:00 / Archived: 2026-11-14 18:30
- Issue: Aqutter/aqutter#57
- Milestone: N/A / Base Branch: main

## Summary
shell 的 Android library 對齊 AGP 9.3.1（Flutter 3.50 要求至少 9.3.1）。

驗證：flutter analyze 無問題、flutter test 270 項通過；另以 aqutter-nuxt-app 暫時改用本機 shell（path override，已還原）建置 Android debug APK 成功，且無 AGP／Kotlin 版本警告。

## Cross-Repo Scope
參與：aqutter_core、aqutter、aqutter-cli、aqutter-nuxt-app（直接推送 main，不開 PR）。共用 ID `2611141800-upgrade-kotlin-agp-flutter-3-50`、共用分支 `feature/2611141800-upgrade-kotlin-agp-flutter-3-50`。順序：core → aqutter → cli → nuxt-app。目標版本：AGP 9.3.1、KGP 2.4.20。

## Key Decisions
- **[核准]** 使用者全部核准（含第三方 plugin 的 KGP 不動）；完成後採預設 commit + 開 PR（nuxt-app 直接推送 main）；Issue 已建立並回填（core#18、aqutter#57、cli#30）。
- **[Phase 0]** 目標 repo：aqutter_core、aqutter、aqutter-cli、aqutter-nuxt-app（來源：3.50 建置警告與各 repo 的 Gradle 檔；aqutter-plugins 無 Android 專案檔，不納入）。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`；各 repo 已在乾淨的 `main`。aqutter-nuxt-app 依其 `project.md` 直接推送 `main`，不開 PR。
- **[Phase 0]** 整合主幹：遠端無 dev／develop 類分支，採 `origin/HEAD`＝`main`，不詢問、不記錄。
- **[Phase 0]** 目標版本取自 3.50 實際建置警告（aqutter_core example，Flutter 3.50.0）：AGP「至少 9.3.1」、Kotlin「至少 2.4.20」；Gradle 9.5.0 已符合。
- **[範圍]** 只改 AGP／KGP 版本與 Built-in Kotlin 遷移；Gradle wrapper 不動。承接前一份升級計畫的評估項目（Kotlin 外掛 2.4.20）。
- **[暫定，核准閘揭露]** 第三方 plugin `file_picker`、`flutter_downloader` 仍套用 KGP（警告指名）：本計畫不動它們，只在回報中列為上游依賴風險 — 理由：非本專案原始碼，升級版本會連帶改變行為，應另案評估。
- **[執行模式]** 序列：`aqutter_core` → `aqutter`（shell）→ `aqutter-cli`（範本）→ `aqutter-nuxt-app`（跟範本）。
- **[實測]** Flutter 3.50.0 建置警告（AGP 9.3.0、Kotlin 2.4.10、app 套用 KGP）在 aqutter_core example 全部消失；僅剩第三方 plugin file_picker、flutter_downloader 套用 KGP 的警告（上游依賴，本計畫不動）。
- **[未驗證]** 全新 `aqutter init` 專案的實跑、多平台實機。

## Deviations
無。

## Impact Files
- `shell/android/build.gradle.kts:13` — AGP `9.3.0` → `9.3.1`
