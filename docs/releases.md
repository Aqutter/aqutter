# 發佈清單（release manifest）

`manifest/releases.json` 記錄「哪些版本的 shell、aqutter_core、client 與 Flutter 是一組」。它是 Aqutter 版本相容性的唯一來源，目的是讓 CLI 與專案不必把這類知識寫死在自己裡面。

> **現況**：這份清單已發佈，但還沒有任何 CLI 版本讀取它。讀取由 `aqutter-cli` 提供（`init`、`doctor`、`upgrade`）。在那之前，專案仍照 [快速開始](getting-started.md) 與 [CLI](cli.md) 的現行方式運作。

## 取得位置

| 資源 | 網址 |
|---|---|
| 清單 | `https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json` |
| JSON Schema | `https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/schema.json` |

## 欄位

頂層：

| 欄位 | 說明 |
|---|---|
| `schema` | 清單格式版本，目前為 `1`；只在不相容變更時才加一 |
| `generatedAt` | 產生時間（UTC），僅供顯示 |
| `channels` | 頻道名稱對應到 `releases` 裡的版本；必含 `stable` |
| `releases` | 版本對應到下列的 release 描述 |

每個 release：

| 欄位 | 說明 |
|---|---|
| `status` | `supported`、`deprecated`（只警告）或 `yanked`（拒絕使用） |
| `flutter.baseline` | 框架建置與測試用的 Flutter 確切版本；專案的 `environment.flutter` 寫為 `>=<baseline>`，不設上限 |
| `dart` | `environment.sdk` 的約束 |
| `shell` | 殼的 git 位置與 `ref`（commit sha） |
| `core` | aqutter_core 的 git 位置與 `ref`（commit sha） |
| `client` | client 的安裝字串 |
| `cli` | `min`：能正確處理此版本的最低 CLI 版本 |
| `notes` | 升級說明的網址（選填） |

規則：

| 規則 | 說明 |
|---|---|
| ref 一律是 commit sha | 不使用 tag，因為開發階段的 tag `0.0.0` 會隨 `main` 移動 |
| 已發佈版本不改欄位 | 只能把 `status` 改為 `deprecated` 或 `yanked`；要修正就新增版本 |
| `stable` 只指向 `supported` | 由 CI 檢查 |
| 未知欄位 | 讀取端必須忽略，日後新增欄位不會讓舊版 CLI 壞掉 |

## 新增或更新一個版本

shell 或 aqutter_core 有變更並推送後：

1. 取得要採用的 commit sha。
2. 修改清單中對應的 `ref`（以及 `client.spec`），更新 `generatedAt`。
3. 在本機驗證格式。
4. 開 PR；CI 會再檢查各 ref 是否存在、Flutter 基準是否與 shell、aqutter_core 的 `pubspec.yaml` 一致。

取得 shell 目前的 commit sha：

```bash
git log -1 --format=%H -- shell
```

驗證格式：

```bash
npx --yes ajv-cli@5.0.0 validate --spec=draft2020 --strict=false -s manifest/schema.json -d manifest/releases.json
```

## 安全

清單只能影響版本字串、ref 與約束這類宣告式欄位。讀取它的程式不得執行清單裡的任何指令，也不得執行由它指向而下載的腳本。`shell.url`、`core.url` 只接受 `https://github.com`。
