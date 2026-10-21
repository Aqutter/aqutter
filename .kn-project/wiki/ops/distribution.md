# 發佈與安裝

## Summary
開發階段的框架不上 npm 與 pub.dev，全部以 git 依賴安裝；shell 與 aqutter_core 使用版本標記，目前固定為 0.0.0，標記隨 main 前進；client 與 cli 已拆到獨立 repo（aqutter-js、aqutter-cli），各有自己的標記。版本之間的對應以發佈清單為準。

## 安裝方式
| 元件 | 安裝來源 | 安裝到哪裡 |
|---|---|---|
| cli | aqutter-cli repo 根目錄 | 網頁專案的開發相依 |
| client | aqutter-js repo 根目錄 | 網頁專案的相依 |
| shell | pubspec 的 git 依賴 | 產生的 Flutter App |
| aqutter_core | pubspec 的 git 依賴，由 shell 帶入 | 產生的 Flutter App |

來源：1. [project.md](../../project.md#L21)　2. [getting-started.md](../../../docs/getting-started.md#L11-L30)

### 安裝 cli

npm、pnpm、yarn 皆可，語法相同；bun 尚未驗證，暫不支援：

```bash
pnpm add -D github:Aqutter/aqutter-cli#0.0.0
```

### 安裝 client

npm、pnpm、yarn 皆可，語法相同：

```bash
pnpm add github:Aqutter/aqutter-js#0.0.0
```

來源：1. [getting-started.md](../../../docs/getting-started.md#L15-L28)

## 限制
| 項目 | 說明 |
|---|---|
| 套件管理器 | cli 與 client 的 npm、pnpm、yarn 都能安裝；bun 尚未驗證 |
| 版本標記 | 0.0.0 會被移動，專案的 pubspec.lock 與套件管理器的 lock 可能落後遠端 |
| 版本檢查 | aqutter doctor 比對 lock 與遠端標記，aqutter upgrade 把專案對齊目前的框架版本 |
| 版本對應 | 框架版本的對應關係另由[發佈清單](release-manifest.md)記錄；aqutter doctor 與 aqutter upgrade 會讀它 |

來源：1. [project.md](../../project.md#L21)　2. [cli.md](../../../docs/cli.md)　3. [releases.md](../../../docs/releases.md)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
