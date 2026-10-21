# 驗證指令

## Summary
修改框架後，修改 shell 後在 shell 目錄執行驗證。client 在 aqutter-js repo、cli 在 aqutter-cli repo，各在自己的 repo 驗證。

## 各部分的驗證
| 部分 | 驗證內容 |
|---|---|
| shell | 靜態分析與單元測試 |

來源：1. [project.md](../../project.md#L31-L36)　2. [AGENTS.md](../../../AGENTS.md#L15-L20)

### 驗證 shell

```bash
cd shell && flutter analyze && flutter test
```

## 規則
| 規則 | 說明 |
|---|---|
| 改動 shell 或 aqutter_core 之後 | 同步更新發佈清單 manifest/releases.json，CI 會檢查 |
| 跨 repo 成對項目 | env 鍵、Flutter 基準版本、範本變數分屬兩個 repo，目前只靠文件約束，沒有跨 repo CI |

來源：1. [AGENTS.md](../../../AGENTS.md#L10-L13)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
