# 發佈清單

## Summary
發佈清單（release manifest）記錄每個框架版本對應的 shell、aqutter_core、client 與 Flutter 版本，以及能處理它的最低 CLI 版本，是版本相容性的唯一來源。它放在本 repo 的 main 上，由 CI 檢查；目前還沒有 CLI 版本讀取它，讀取由獨立 repo aqutter-cli 提供。

## 清單位置
| 資源 | 說明 |
|---|---|
| 清單 | 本 repo 的 manifest 目錄，以固定的 raw 網址提供，無需驗證 |
| 格式描述 | 同目錄的 JSON Schema，CI 用它驗證清單 |
| 使用者說明 | docs 目錄的發佈清單頁 |

固定網址：

```text
https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json
```

來源：1. [releases.json](../../../manifest/releases.json)　2. [schema.json](../../../manifest/schema.json)　3. [releases.md](../../../docs/releases.md)

## 欄位
| 欄位 | 說明 |
|---|---|
| 頻道 | 頻道名稱對應到版本；必含 stable，且 stable 只能指向 supported 的版本 |
| 狀態 | supported、deprecated（只警告）或 yanked（拒絕使用） |
| Flutter 基準 | 框架建置與測試用的確切版本；專案要求這個版本以上，不設上限 |
| 殼與 aqutter_core | git 位置加完整的 commit 值，不使用 tag |
| client | 安裝字串 |
| 最低 CLI 版本 | 能正確處理此版本的最低 CLI 版本 |

來源：1. [schema.json](../../../manifest/schema.json#L1-L110)

## 規則
| 規則 | 說明 |
|---|---|
| ref 一律是 commit | 開發階段的 tag 會隨 main 移動，清單不引用 tag |
| 已發佈版本不改欄位 | 只能把狀態改為 deprecated 或 yanked；要修正就新增版本 |
| 讀取端忽略未知欄位 | 日後新增欄位不影響舊版讀取端 |
| 只含宣告式資料 | 讀取端不得執行清單裡的任何指令或下載的腳本 |
| 主機允許清單 | git 網址只接受 github.com 的 https 位置 |

來源：1. [releases.md](../../../docs/releases.md#L41-L50)

## 檢查
每次動到清單、殼的 pubspec 或檢查本身時，CI 依序確認：

| 檢查 | 說明 |
|---|---|
| 格式 | 清單符合 JSON Schema |
| 頻道 | 每個頻道指向存在的版本，stable 是 supported |
| 引用存在 | 殼、aqutter_core 與 client 引用的 commit 在 GitHub 上都存在 |
| 基準一致 | Flutter 基準與殼、aqutter_core 在該 commit 的 pubspec 要求一致，Dart 約束與殼一致 |

來源：1. [manifest-check.yml](../../../.github/workflows/manifest-check.yml)

---
[🏠 Wiki](../index.md)
