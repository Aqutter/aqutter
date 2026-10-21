WIKI_PAGE("dev/verification.md",{
"title":"驗證指令",
"summary":"修改框架後，依改動的部分分別在 shell、client、cli 三個目錄執行驗證。cli 另外要重新打包並把打包產物一起提交，因為使用者直接從 GitHub 安裝它。",
"svgs":{},
"seq":{},
"ext":["../AGENTS.md", "archive/2610211114-split-cli-to-aqutter-cli-repo.md", "project.md"],
"changelog":[{"plan": "2610211114-split-cli-to-aqutter-cli-repo", "date": "2026-10-21", "version": "—", "note": "建立", "issue": "[#2](https://github.com/Aqutter/aqutter/issues/2)", "pr": "—"}],
"md":"# 驗證指令\n\n## Summary\n修改框架後，依改動的部分分別在 shell、client、cli 三個目錄執行驗證。cli 另外要重新打包並把打包產物一起提交，因為使用者直接從 GitHub 安裝它。\n\n## 各部分的驗證\n| 部分 | 驗證內容 |\n|---|---|\n| shell | 靜態分析與單元測試 |\n| client | 型別檢查與單元測試 |\n| cli | 型別檢查、單元測試與重新打包 |\n\n來源：1. [project.md](../../project.md#L35-L39)　2. [AGENTS.md](../../../AGENTS.md#L15-L20)\n\n### 驗證 shell\n\n```bash\ncd shell && flutter analyze && flutter test\n```\n\n### 驗證 client\n\n```bash\ncd client && pnpm typecheck && pnpm test\n```\n\n### 驗證 cli\n\n```bash\ncd cli && pnpm typecheck && pnpm test && pnpm build\n```\n\n來源：1. [AGENTS.md](../../../AGENTS.md#L17-L21)\n\n## 規則\n| 規則 | 說明 |\n|---|---|\n| 提交 cli 的變更 | 改動 cli 的原始碼或範本後，必須重新打包並一併提交打包產物 |\n| 範本變數 | 範本內只能使用初始化與 plugin 建立指令提供的變數，由測試檢查 |\n\n來源：1. [AGENTS.md](../../../AGENTS.md#L11-L13)\n\n---\n[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)\n"
});
