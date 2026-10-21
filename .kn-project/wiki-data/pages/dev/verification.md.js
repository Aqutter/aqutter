WIKI_PAGE("dev/verification.md",{
"title":"驗證指令",
"summary":"修改框架後，依改動的部分分別在 shell、client 兩個目錄執行驗證。cli 已拆到 aqutter-cli repo，在該 repo 驗證。",
"svgs":{},
"seq":{},
"ext":["../AGENTS.md", "archive/2610211114-split-cli-to-aqutter-cli-repo.md", "archive/2610211452-finish-cli-split-docs-and-remove-cli.md", "project.md"],
"changelog":[{"plan": "2610211452-finish-cli-split-docs-and-remove-cli", "date": "2026-10-21", "version": "—", "note": "cli 拆到獨立 repo 後的說明改寫", "issue": "[#4](https://github.com/Aqutter/aqutter/issues/4)", "pr": "[PR #6](https://github.com/Aqutter/aqutter/pull/6)"}, {"plan": "2610211114-split-cli-to-aqutter-cli-repo", "date": "2026-10-21", "version": "—", "note": "建立", "issue": "[#2](https://github.com/Aqutter/aqutter/issues/2)", "pr": "—"}],
"md":"# 驗證指令\n\n## Summary\n修改框架後，依改動的部分分別在 shell、client 兩個目錄執行驗證。cli 已拆到 aqutter-cli repo，在該 repo 驗證。\n\n## 各部分的驗證\n| 部分 | 驗證內容 |\n|---|---|\n| shell | 靜態分析與單元測試 |\n| client | 型別檢查與單元測試 |\n\n來源：1. [project.md](../../project.md#L31-L36)　2. [AGENTS.md](../../../AGENTS.md#L15-L20)\n\n### 驗證 shell\n\n```bash\ncd shell && flutter analyze && flutter test\n```\n\n### 驗證 client\n\n```bash\ncd client && pnpm typecheck && pnpm test\n```\n\n## 規則\n| 規則 | 說明 |\n|---|---|\n| 改動 shell 或 aqutter_core 之後 | 同步更新發佈清單 manifest/releases.json，CI 會檢查 |\n| 跨 repo 成對項目 | env 鍵、Flutter 基準版本、範本變數分屬兩個 repo，目前只靠文件約束，沒有跨 repo CI |\n\n來源：1. [AGENTS.md](../../../AGENTS.md#L10-L13)\n\n---\n[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)\n"
});
