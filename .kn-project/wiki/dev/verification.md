# 驗證指令

## Summary
修改框架後，依改動的部分分別在 shell、client、cli 三個目錄執行驗證。cli 另外要重新打包並把打包產物一起提交，因為使用者直接從 GitHub 安裝它。

## 各部分的驗證
| 部分 | 驗證內容 |
|---|---|
| shell | 靜態分析與單元測試 |
| client | 型別檢查與單元測試 |
| cli | 型別檢查、單元測試與重新打包 |

來源：1. [project.md](../../project.md#L35-L39)　2. [AGENTS.md](../../../AGENTS.md#L15-L20)

### 驗證 shell

```bash
cd shell && flutter analyze && flutter test
```

### 驗證 client

```bash
cd client && pnpm typecheck && pnpm test
```

### 驗證 cli

```bash
cd cli && pnpm typecheck && pnpm test && pnpm build
```

來源：1. [AGENTS.md](../../../AGENTS.md#L17-L21)

## 規則
| 規則 | 說明 |
|---|---|
| 提交 cli 的變更 | 改動 cli 的原始碼或範本後，必須重新打包並一併提交打包產物 |
| 範本變數 | 範本內只能使用初始化與 plugin 建立指令提供的變數，由測試檢查 |

來源：1. [AGENTS.md](../../../AGENTS.md#L11-L13)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
