WIKI_PAGE("ops/distribution.md",{
"title":"發佈與安裝",
"summary":"開發階段的框架不上 npm 與 pub.dev，全部以 git 依賴安裝；shell、client、cli 與 aqutter_core 共用同一個版本標記，目前固定為 0.0.0，標記隨 main 前進。cli 的打包產物納入版控，使用者直接從 GitHub 安裝時不必在本機編譯。",
"svgs":{},
"seq":{},
"ext":["../docs/getting-started.md", "archive/2610211114-split-cli-to-aqutter-cli-repo.md", "project.md"],
"changelog":[{"plan": "2610211114-split-cli-to-aqutter-cli-repo", "date": "2026-10-21", "version": "—", "note": "建立", "issue": "[#2](https://github.com/Aqutter/aqutter/issues/2)", "pr": "—"}],
"md":"# 發佈與安裝\n\n## Summary\n開發階段的框架不上 npm 與 pub.dev，全部以 git 依賴安裝；shell、client、cli 與 aqutter_core 共用同一個版本標記，目前固定為 0.0.0，標記隨 main 前進。cli 的打包產物納入版控，使用者直接從 GitHub 安裝時不必在本機編譯。\n\n## 安裝方式\n| 元件 | 安裝來源 | 安裝到哪裡 |\n|---|---|---|\n| cli | GitHub 子目錄 | 網頁專案的開發相依 |\n| client | GitHub 子目錄 | 網頁專案的相依 |\n| shell | pubspec 的 git 依賴 | 產生的 Flutter App |\n| aqutter_core | pubspec 的 git 依賴，由 shell 帶入 | 產生的 Flutter App |\n\n來源：1. [project.md](../../project.md#L20)　2. [getting-started.md](../../../docs/getting-started.md#L13-L17)\n\n### 安裝 cli\n\n```bash\npnpm add -D \"github:Aqutter/aqutter#0.0.0&path:/cli\"\n```\n\n### 安裝 client\n\n```bash\npnpm add \"github:Aqutter/aqutter#0.0.0&path:/client\"\n```\n\n來源：1. [getting-started.md](../../../docs/getting-started.md#L16-L17)\n\n## 限制\n| 項目 | 說明 |\n|---|---|\n| 套件管理器 | 子目錄安裝的寫法只有 pnpm 支援，npm 與 yarn 無法安裝 |\n| 版本標記 | 0.0.0 會被移動，專案的 pubspec.lock 與套件管理器的 lock 可能落後遠端 |\n| 版本檢查 | aqutter doctor 比對 lock 與遠端標記，aqutter upgrade 把專案對齊目前的框架版本 |\n| 版本對應 | 框架版本的對應關係另由[發佈清單](release-manifest.md)記錄；目前還沒有 CLI 版本讀取它 |\n\n來源：1. [project.md](../../project.md#L20-L21)　2. [doctor.ts](../../../cli/src/commands/doctor.ts)　3. [upgrade.ts](../../../cli/src/commands/upgrade.ts)\n\n---\n[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)\n"
});
