# 發佈與安裝

## Summary
開發階段的框架不上 npm 與 pub.dev，全部以 git 依賴安裝；shell、client、cli 與 aqutter_core 共用同一個版本標記，目前固定為 0.0.0，標記隨 main 前進。cli 的打包產物納入版控，使用者直接從 GitHub 安裝時不必在本機編譯。

## 安裝方式
| 元件 | 安裝來源 | 安裝到哪裡 |
|---|---|---|
| cli | GitHub 子目錄 | 網頁專案的開發相依 |
| client | GitHub 子目錄 | 網頁專案的相依 |
| shell | pubspec 的 git 依賴 | 產生的 Flutter App |
| aqutter_core | pubspec 的 git 依賴，由 shell 帶入 | 產生的 Flutter App |

來源：1. [project.md](../../project.md#L20)　2. [getting-started.md](../../../docs/getting-started.md#L13-L17)

### 安裝 cli

```bash
pnpm add -D "github:Aqutter/aqutter#0.0.0&path:/cli"
```

### 安裝 client

```bash
pnpm add "github:Aqutter/aqutter#0.0.0&path:/client"
```

來源：1. [getting-started.md](../../../docs/getting-started.md#L16-L17)

## 限制
| 項目 | 說明 |
|---|---|
| 套件管理器 | 子目錄安裝的寫法只有 pnpm 支援，npm 與 yarn 無法安裝 |
| 版本標記 | 0.0.0 會被移動，專案的 pubspec.lock 與套件管理器的 lock 可能落後遠端 |
| 版本檢查 | aqutter doctor 比對 lock 與遠端標記，aqutter upgrade 把專案對齊目前的框架版本 |
| 版本對應 | 框架版本的對應關係另由[發佈清單](release-manifest.md)記錄；目前還沒有 CLI 版本讀取它 |

來源：1. [project.md](../../project.md#L20-L21)　2. [doctor.ts](../../../cli/src/commands/doctor.ts)　3. [upgrade.ts](../../../cli/src/commands/upgrade.ts)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
