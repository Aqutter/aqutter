<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610211114 - split-cli-to-aqutter-cli-repo
- Created: 2026-10-21
- Branch: feature/2610211114-split-cli-to-aqutter-cli-repo（待核准後建立）
- Issue: 待建立（Phase 2 核准後）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Planning
- Completed: [Wait for Finish]

## Goals
1. 把 `cli/`（npm 套件 `@aqutter/aqutter-cli`）拆成獨立 repo `Aqutter/aqutter-cli`，`client/` 與 `shell/` 留在本 repo。拆出後 CLI 可用 `github:Aqutter/aqutter-cli#<ref>` 安裝，npm、yarn、bun、pnpm 皆可（現在的 `&path:/cli` 子目錄語法只有 pnpm 支援，npm 與 yarn 已實測失敗）。
2. CLI 不再把「升級與相容性的知識」寫死在自己裡面：`init`、`doctor`、`upgrade` 改讀一份公開的 **release manifest**，由它決定這個框架版本該搭配哪個 shell／aqutter_core／範本／Flutter 基準。
3. 專案範本（`cli/template/`，Flutter App 與 plugin 的骨架）**維持在 CLI 內**，隨 CLI 一起搬到新 repo；本計畫不搬遷、不做範本下載。（日後若要提供「建立新網頁專案」的範本，另案處理，manifest 格式保留擴充空間。）
4. 本計畫**只交付本 repo（`Aqutter/aqutter`）這一側**：manifest 與其 schema、文件與治理檔更新、舊 `cli/` 的過渡處理。`aqutter-cli` 新 repo 與下游範本專案各有自己的計畫（見 Cross-Repo Scope）。

## Architecture
拆分前後的責任：

| 項目 | 拆分前 | 拆分後 |
|---|---|---|
| CLI 原始碼與 `dist/` | `Aqutter/aqutter` 的 `cli/` | `Aqutter/aqutter-cli` |
| 專案範本（app、plugin、env） | `cli/template/`，隨 CLI 發佈 | 不變：仍隨 CLI 發佈（跟著 CLI 搬到 `aqutter-cli`） |
| 版本相容知識 | CLI 的 `pkg.version` 兼作殼 ref，Flutter 基準由範本推得 | `manifest/releases.json`（公開、可獨立更新） |
| client | `client/`，pnpm 子目錄安裝 | 不變（發佈方式另案處理） |

CLI 取得知識的路徑：

1. `init`／`doctor`／`upgrade` 讀 manifest（快取優先、可離線，細節見 Contract §4）。
2. 依 manifest 的 `releases[<版本>]` 取得 shell 與 aqutter_core 的 ref、Flutter 基準、最低 CLI 版本。
3. `init` 把 manifest 的 shell ref 寫進新專案的 pubspec；範本仍由 CLI 自己內嵌。
4. `doctor` 的「lock 是否落後」改為比對 `pubspec.lock` 的 `resolved-ref` 與 manifest 的 commit，不再需要 `git ls-remote`。

**不變的部分**：`aqutter.config.json` 格式、`dev`／`seed`／`build`／`flavor`／`plugin add` 等指令的行為、跨語言「成對」規則（client 與 shell 的契約仍在同一個 repo，一起改）。

**拆分帶來的新風險（範本留在 CLI 的後果）**：範本裡的 `environment.flutter` 與 env 範例鍵，原本與 shell 在同一個 repo 一起改，拆分後橫跨兩個 repo。緩解方式：Flutter 基準以 manifest 的 `flutter.baseline` 為單一來源，由 `aqutter-cli` 的 CI 檢查範本與它一致；env 鍵與 shell 的對照也由 `aqutter-cli` 的 CI 負責（該計畫設計）。

程式碼將遵守 `kn-project-code-style`（TypeScript 與 Dart 規範）。

## Cross-Repo Scope
- **本計畫所屬 repo**: `Aqutter/aqutter`
- **共用計畫 ID**: `2610211114-split-cli-to-aqutter-cli-repo`　**共用分支名**: `feature/2610211114-split-cli-to-aqutter-cli-repo`
- **參與 repo 與職責**:
  - `Aqutter/aqutter` — 契約提供方：發佈 manifest 與 schema、更新文件與治理檔、舊 `cli/` 的過渡處理（本計畫）。issue: `待建立`
  - `Aqutter/aqutter-cli`（**新 repo，尚未存在**）— 契約消費方：承接 `cli/`（含範本）的歷史與程式碼，改為讀 manifest，支援新舊兩種依賴語法的偵測與改寫，並在自己的 CI 檢查範本與 manifest 一致。issue: `待建立`
  - `Aqutter/aqutter-nuxt-app` — 下游：把 `package.json` 的 CLI 依賴改成新語法並用新版 CLI 跑 `aqutter upgrade`。issue: `待建立`
- **執行順序相依**: 契約（manifest schema 與取得位置）凍結並於本 repo 發佈後，才能開始 `aqutter-cli` 的計畫；`aqutter-cli` 發佈新版後，才處理下游範本專案。契約提供方先，消費方後。
- **移除 `cli/` 的閘門（Q3 選 B）**: 本 repo 移除 `cli/` 這一步（tasks.md Phase 5）**必須最後做**，且須等 `aqutter-cli` 已建立、完整保留歷史、可用新語法在 npm／yarn／pnpm 安裝並跑通 `aqutter --version`（bun 見 Manual Follow-ups）、下游範本專案已改用新語法。移除後，所有仍用 `github:Aqutter/aqutter#…&path:/cli` 的專案下次安裝會立即失敗。
- **他 repo 的計畫何時建立**: `aqutter-cli` 尚不存在，無法放置 `.kn-project/`，其計畫待新 repo 建立並完成治理初始化後，沿用同一組 `${ID}-${description}` 與同一個分支名建立。下游範本專案 `aqutter-nuxt-app` 的計畫已隨本計畫一同建立（Q5 選 B），位於該 repo 的 `.kn-project/plans/2610211114-split-cli-to-aqutter-cli-repo/`。
- **跨 repo 檔案指涉**:
  - `aqutter-cli`：現有的 `cli/src/commands/init.ts:112`、`plugin.ts:85-86`、`doctor.ts:46-52`、`template.ts:33-43`、`versioning.ts:209`、`versioning.ts:235`、`main.ts:2-4` 需要改寫（內容見 Contract §5）；`cli/test/plugins.test.ts:80` 的範本測試隨範本一起搬走，維持不變。
  - `aqutter-nuxt-app`：`package.json:62`（`@aqutter/aqutter-cli` 的依賴語法）。

## Contract / 介面契約
- **契約正本 repo**: `Aqutter/aqutter`　**修訂號**: `rev 1`　**狀態**: `草擬`

> 本契約是 `aqutter`（提供方）與 `aqutter-cli`（消費方）之間唯一的介面：一份 JSON manifest。CLI 不得從 manifest 以外的地方推導版本相容性。

### 1. 取得位置
| # | 資源 | 位置 | 說明 |
|---|---|---|---|
| 1 | manifest | `https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json`（Q1 已確認） | HTTPS GET，回應為 UTF-8 JSON，無需驗證 |
| 2 | manifest schema | 本 repo 的 `manifest/schema.json`（JSON Schema 2020-12） | 提供方的 CI 以它驗證 `manifest/releases.json` |

CLI 內建預設的 manifest 網址，可被環境變數 `AQUTTER_MANIFEST_URL` 或 `aqutter.config.json` 的 `manifest.url` 覆寫（企業鏡像與測試用）。

### 2. manifest 欄位
頂層：

| 欄位 | 型別 | 必填 | 可空 | 說明與限制 |
|---|---|---|---|---|
| `schema` | integer | 是 | 否 | manifest 格式版本，目前為 `1`。CLI 遇到比自己支援更大的值必須中止並提示升級 CLI |
| `generatedAt` | string | 是 | 否 | ISO 8601 UTC，僅供顯示與診斷，不參與任何判斷 |
| `channels` | object | 是 | 否 | 鍵為頻道名，值為 `releases` 中存在的版本字串。必含 `stable`；可含 `dev` |
| `releases` | object | 是 | 否 | 鍵為版本字串（`X.Y.Z`，開發階段為 `0.0.0`），值為下表的 release 物件。至少一筆 |

`releases[<版本>]`：

| 欄位 | 型別 | 必填 | 可空 | 說明與限制 |
|---|---|---|---|---|
| `status` | string | 是 | 否 | `supported`／`deprecated`／`yanked`。`yanked` 的版本 CLI 一律拒絕使用；`deprecated` 只警告 |
| `flutter` | object | 是 | 否 | `{ "baseline": "X.Y.Z" }`。`baseline` 為框架建置與測試的 Flutter 確切版本；專案 `environment.flutter` 寫為 `>=<baseline>`（不設上限） |
| `dart` | string | 是 | 否 | `environment.sdk` 的約束字串，例如 `>=3.13.0 <4.0.0` |
| `shell` | object | 是 | 否 | `{ "url": "<git url>", "path": "shell", "ref": "<ref>" }`。`ref` 為 tag 或 40 位十六進位 commit sha；`url` 必須在 §4 的允許清單內 |
| `core` | object | 是 | 否 | `{ "url": "<git url>", "ref": "<ref>" }`，規則同 `shell`；僅供 `doctor` 比對 lock，不寫入專案的 pubspec（由 shell 的 pubspec 帶入） |
| `client` | object | 是 | 否 | `{ "spec": "<npm 依賴字串>" }`。目前為 `github:Aqutter/aqutter#<ref>&path:/client`；之後 client 發佈到 npm 時改為 npm 版本字串 |
| `cli` | object | 是 | 否 | `{ "min": "X.Y.Z" }`：其內嵌範本與此 release 的 shell 相容的最低 CLI 版本。比 `min` 舊的 CLI 必須中止並提示升級 |
| `notes` | string | 否 | 是 | 升級說明的網址（HTTPS）；`deprecated`／`yanked` 時建議提供 |

序列化：所有物件鍵都必須輸出，`notes` 無值時省略該鍵（不輸出 `null`）。版本字串、sha 一律小寫。

向前相容：CLI **必須忽略**不認識的欄位（日後新增 `templates` 等欄位時，舊 CLI 不受影響）；`schema` 只在不相容變更時才加一。

### 3. 範本（本版不在契約內）
範本（App 與 plugin 的骨架、env 範例）維持內嵌在 CLI，不經由 manifest 散佈。CLI 內嵌的範本與 manifest 的相容性只用 `cli.min` 表達；範本的 `environment.flutter` 必須等於 `flutter.baseline`（由 `aqutter-cli` 的 CI 檢查）。

### 4. CLI 取得 manifest 的行為
| 情況 | 行為 |
|---|---|
| 一般 | 快取（使用者目錄的 aqutter 快取資料夾）有效期 24 小時內直接用；過期則重抓並覆寫快取 |
| 抓取失敗（無網路、HTTP 非 200、逾時 15 秒） | 退回快取（不論是否過期，並警告）；再退回 CLI 內建的最後已知 manifest；都沒有才失敗 |
| 加 `--offline` | 不連網：只用快取，再退回內建 |
| `schema` 大於 CLI 支援 | 中止，提示「請升級 aqutter-cli」 |
| JSON 不符 schema | 視為抓取失敗（走上面的退回路徑），並警告 |
| 網址 | 只接受 `https`；`shell.url`、`core.url` 的主機必須在允許清單：`github.com` |
| 安全 | manifest 只能影響「版本字串、ref、約束」這類宣告式欄位；CLI **不得**執行 manifest 中的任何指令或下載的腳本 |

`dev`、`build`、`seed` 不查 manifest（避免每次開發都連網）。`init`、`doctor`、`upgrade` 才查（`plugin create` 若需要殼 ref 也查）。

### 5. CLI 因此要做的改變（供 `aqutter-cli` 計畫使用，本計畫不實作）
| 現況（monorepo） | 改為 |
|---|---|
| `init.ts:112` 殼 ref 預設為 CLI 的 `pkg.version` | 取 `channels.stable` 對應 release 的 `shell.ref`（旗標 `--shell-ref` 可覆寫） |
| `init.ts:112`、`plugin.ts:85-86` 的殼 ref 與 client ref 取自 `pkg.version` | 取 release 的 `shell.ref` 與 `client.spec` |
| `doctor.ts:46-52` 以範本推導 Flutter 基準 | 取 release 的 `flutter.baseline`、`dart` |
| `doctor` 以 `git ls-remote` 查 lock 是否落後 | 比對 `pubspec.lock` 的 `resolved-ref` 與 release 的 `shell.ref`／`core.ref`（ref 為 tag 時才退回 `ls-remote`） |
| `versioning.ts:209`、`235` 只認 `github:Aqutter/aqutter#…&path:` | 同時認新語法 `github:Aqutter/aqutter-cli#…`，並由 `upgrade` 把舊語法改寫為新語法 |
| `upgrade` 以 CLI 版本為目標 | 以 manifest 的 `channels.stable`（或 `--to=<版本>`）為目標 |

### 6. 狀態與規則
- release 一旦發佈，既有版本的欄位不得改動（只可把 `status` 改為 `deprecated`／`yanked`）；要修正就新增版本。
- `channels.stable` 只能指向 `status` 為 `supported` 的 release。
- 開發階段的 `0.0.0`：允許 `shell.ref`／`core.ref` 為會移動的 tag `0.0.0`，或 commit sha（Open Questions Q4 決定）。

### 7. 相容性
- 本契約是新增，不改動現有 client、shell、aqutter_core 的任何介面。
- 現有專案的 `aqutter.config.json`、`pubspec.yaml`、`package.json` 不需要立刻改動；舊版 CLI 不認識 manifest，行為與現在相同。
- 舊的 `github:Aqutter/aqutter#…&path:/cli` 依賴在過渡期內仍可安裝（見 Q3）。

### 8. 變更紀錄
- _(尚無)_

## Impact Files
- `cli/` (整個目錄，含 `cli/package.json:2`、`cli/src/`、`cli/test/`、`cli/template/`、`cli/scripts/build.mjs:2`、`cli/dist/aqutter.mjs`) — 內容（含範本）先以保留歷史的方式搬到 `aqutter-cli`（`git subtree split --prefix=cli` 之類，在 `aqutter-cli` 計畫內執行），確認新 repo 可安裝後，本 repo 以 `git rm` 移除整個 `cli/`（Q3 選 B）。
- `AGENTS.md:10-13` — 紅線 3（env 鍵三處成對，其中 `cli/template/env/.env.example` 將在別的 repo）、4（`cli/dist/` 規則移到新 repo）、4.1（Flutter 版本成對：範本改在新 repo，基準另由 manifest 的 `flutter.baseline` 表達）、5（範本變數）需改寫；同時 `AGENTS.md:7` 的名稱定案與 `AGENTS.md:15-20` 的驗證指令（含 `cd cli …`）要隨 `cli/` 的去留更新。
- `README.md:20-21` — 安裝 CLI 的指令改為新語法，並列出四種套件管理器。
- `docs/getting-started.md:16-17` — 同上；補「各套件管理器的安裝方式」。
- `client/README.md:14` — client 的安裝說明（子目錄語法仍適用 pnpm，補其他管理器的現況與限制）。
- `docs/cli.md:94`（`## aqutter doctor`）、`docs/cli.md:113`（`## aqutter upgrade`）— 改寫為讀 manifest 的行為，並補 `--offline`、`AQUTTER_MANIFEST_URL`。
- `.kn-project/project.md:12`、`:20`、`:22` — 組成表（`cli/` 一列）、「以 git 依賴發佈」一段與「CLI 不寫死框架」一段，需改為拆分後的描述。
- `.kn-project/wiki/ops/distribution.md` — 發佈與安裝頁（本次 bootstrap 建立）要隨安裝方式更新。
- `.kn-project/wiki/platform/architecture.md` — 架構總覽的組成表要改。
- `manifest/releases.json` (new) — release manifest 的正本，Contract §2。
- `manifest/schema.json` (new) — manifest 的 JSON Schema，Contract §1。
- `.github/workflows/manifest-check.yml` (new) — 驗證 manifest 符合 schema、各 ref 在遠端存在、`flutter.baseline` 與本 repo 的 `shell/pubspec.yaml`、`aqutter_core` 的 Flutter 下限一致、`channels.stable` 指向 `supported`。
- `docs/releases.md` (new) — 給使用者看的 manifest 與升級說明頁。

## App-Flow Screens
- （本 repo 無 `.kn-project/app-flow.json`，刪除本節）

## Open Questions / 待確認事項
> 尚未確認、會影響實作方向的行為或決策。**全部釐清前不得進入 Phase 3。**

### Q1. manifest 要放在哪個網址？ — 影響範圍：Contract §1、`manifest/`、CLI 內建預設網址
- [x] 選項 A：本 repo `main` 上的 `manifest/releases.json`，以 `raw.githubusercontent.com` 提供　(建議，理由：不依賴尚未完成的文件網站（issue #1）、版本與程式碼同在 git、不需部署)
- [ ] 選項 B：GitHub Pages（`https://aqutter.github.io/aqutter/releases.json`）　（需先完成說明網站與部署）
- [ ] 選項 C：GitHub Release 的附件
- **決議**：選項 A　狀態：✅ 已確認

### Q2. 專案範本怎麼處理？ — 影響範圍：Goals、Contract §3、Impact Files
- [x] 選項 A：範本（Flutter App／plugin 骨架與 env 範例）留在 CLI 內，隨 CLI 搬到 `aqutter-cli`；本計畫不搬遷、不做下載　(建議，理由：計畫縮小，舊 `cli/` 的過渡也不需複製範本)
- [ ] 選項 B：範本搬回本 repo，由 CLI 依 manifest 下載
- **決議**：選項 A　狀態：✅ 已確認（使用者說明：範本的用途是日後讓 CLI 建立新專案的範本，現在可以不做；釐清後確認範本維持在 CLI 內，「建立新網頁專案」範本記為未來功能）

### Q3. 舊的 `&path:/cli` 安裝語法怎麼過渡？ — 影響範圍：`cli/`、`AGENTS.md`、`README.md`
- [ ] 選項 A：本 repo 保留 `cli/` 的凍結副本，加上「已搬到 aqutter-cli」的棄用訊息，之後另案移除　(建議，理由：現有 pnpm 專案不會立刻壞，使用者有時間用 `aqutter upgrade` 改寫依賴)
- [x] 選項 B：直接移除 `cli/`　（所有用舊語法的專案下次安裝立即失敗）
- **決議**：選項 B（使用者選擇，未採納建議的 A）　狀態：✅ 已確認。後果與保護措施見 Key Decisions 與 Cross-Repo Scope 的執行順序。

### Q4. 開發階段的版本與 tag 怎麼處理？ — 影響範圍：Contract §6、manifest 更新流程
- [x] 選項 A：沿用 `0.0.0`（tag 隨 `main` 前進），manifest 的 `shell.ref`／`core.ref` 一律寫 commit sha（由 CI 或維護者在發佈時更新）　(建議，理由：與現行工作流程一致；固定在 sha 解決了 tag 移動造成的 lock 過期)
- [ ] 選項 B：新 repo 與 manifest 從一開始就用 `0.1.0` 之類的真實版本與不可移動的 tag
- **決議**：選項 A　狀態：✅ 已確認

### Q5. `aqutter-cli` 與下游範本專案的計畫要不要現在就一併建立？ — 影響範圍：Cross-Repo Scope（Rule 19）
- [ ] 選項 A：本次只核准 `aqutter` 這一份；其他兩份待條件成熟時再建立　(建議，理由：`aqutter-cli` 尚不存在、無處放治理檔；下游依賴 CLI 新版，現在建立只會長期停在 Planning)
- [x] 選項 B：現在就為下游範本專案建立計畫（`aqutter-cli` 仍須待新 repo 建立）
- **決議**：選項 B（使用者選擇，未採納建議的 A）　狀態：✅ 已確認。`aqutter-nuxt-app` 的計畫於本次同步建立；`aqutter-cli` 仍待新 repo 建立。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 通知既有使用者（含外部使用者）把 `package.json` 的 CLI 依賴改成新語法 — 在專案內執行 `aqutter upgrade`，或手動改寫依賴字串後重新安裝 — 舊語法在其他套件管理器本來就裝不起來，且是否還有外部使用者只有你知道，agent 無法通知
- **[合併前]** 在有 bun 的環境驗證 `github:Aqutter/aqutter-cli#<ref>` 可以安裝並執行 `aqutter --version` — 在該環境執行 `bun add -d "github:Aqutter/aqutter-cli#<ref>"` — agent 的環境沒有 bun，無法代測；`cli/` 移除後無法回復舊語法，所以需要先確認
- **[合併前]** 確認 `aqutter-cli` 已發佈且 `aqutter-nuxt-app` 已改用新語法，才合併移除 `cli/` 的變更 — 見 Cross-Repo Scope 的閘門 — 跨 repo 的先後只有人能最後把關

## Key Decisions
- **[Phase 0]** 目標 repo 為 `Aqutter/aqutter`（依據：請求指名此 repo；`cli/` 與 `cli/template/` 皆在其中）— 理由：對話明確指名。
- **[Phase 0]** 整合主幹為 `main` — 理由：遠端只有 `main` 一條分支，無 dev 類候選，不需詢問。
- **[Phase 0]** wiki 初始化：是 — 理由：使用者於 bootstrap 詢問時選擇初始化；已建立 `.kn-project/wiki/`（index、環境變數頁、三個內容頁），硬閘 0 項、風格警告 3 項。
- **[Phase 0]** Milestone：不指定，`${BASE_BRANCH}` 為 `main` — 理由：使用者選「不指定」；`project.md` 也寫明開發階段直接推 `main`。
- **[設計]** 只拆 `cli`，`client` 留在本 repo — 理由：`cli` 與其他部分沒有程式碼耦合，而 client↔shell 的契約需要同一個 commit 一起改（對話 2026-10-21）。
- **[Q1]** manifest 放在本 repo `main` 的 `manifest/releases.json`，以 raw 網址提供 — 理由：不依賴尚未完成的說明網站、與程式碼同在 git、不需部署。
- **[Q3]** 直接移除 `cli/`（選項 B，使用者選擇；建議是 A）— 理由：使用者選擇；**後果**：舊語法立即失效。**保護措施**：移除放在最後、需等 `aqutter-cli` 可安裝且下游已遷移（見 Cross-Repo Scope 的閘門與 Manual Follow-ups）；歷史以 `subtree split` 之類的方式在搬出時保留。
- **[Q4]** 沿用 `0.0.0`，manifest 的 `shell.ref`／`core.ref` 寫 commit sha — 理由：與現行工作流程一致；固定在 sha 解決 tag 移動造成的 lock 過期。
- **[Q5]** 現在就為 `aqutter-nuxt-app` 建立計畫，`aqutter-cli` 待新 repo 建立後再建（使用者選擇，未採納建議的僅一份）— 理由：使用者選擇；Rule 19 Fan-Out 逐 repo 一份計畫，共用同一組 `${ID}-${description}` 與分支名。
- **[Q2]** 範本留在 CLI，本計畫不搬不下載；「建立新網頁專案」的範本為未來功能 — 理由：使用者表示範本現在可以不做；縮小範圍。**後果**：範本的 Flutter 版本與 env 鍵與 shell 的成對規則橫跨兩個 repo，改由 manifest 的 `flutter.baseline` 與 `aqutter-cli` 的 CI 檢查承接。
- **[設計]** 升級與相容知識放在遠端 manifest，不寫死在 CLI — 理由：使用者要求 CLI 日後可透過網路資源判斷升級；且 CLI 與 shell 不再共用版本字串（對話 2026-10-21）。
- **[設計]** manifest 只准宣告式欄位、不執行下載內容 — 理由：它會驅動檔案修改，是供應鏈風險點；遷移邏輯仍隨 CLI 發佈。
- **[佐證]** npm 與 yarn 無法安裝 `github:…#…&path:/cli`（實測：npm 回 `Could not read package.json`，yarn 回 `Couldn't find match for "0.0.0&path:/cli"`）；bun 未驗證 — 這是拆分的主要動機。

## Git Completion Policy
- PR 一律以 `--base ${BASE_BRANCH}`（`main`）顯式指定 base，不依賴 `gh` 的預設值 (Rule 23)。
- Issue 綁定時，**每個 commit 訊息**與 PR body 都必須含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`，**不是** `${ID}`）。歸檔完成後於該 issue 張貼由 archive 蒸餾的結案留言 (Rule 20)。
- Issue 的關閉發生在**合併後清理**（使用者回報已合併、內容驗證通過），不在歸檔當下 (Rule 21 步驟 6)。
- commit 一律自動（Rule 17）。完成時依核准閘的「完成後」選項：選 push 或 PR 才會 `git fetch` 後 `git rebase origin/main` 並更新遠端工作分支（`git push --force-with-lease --force-if-includes`）；選只 commit 則兩者都不做。
- 本 repo 的 `project.md` 寫明開發階段直接推送 `main`、不開 PR；「完成後」選項於核准閘由使用者決定，不預設沿用上一個計畫 (Rule 16)。
- 跨 repo 時，本 repo 自己開自己的 PR；不存在橫跨多 repo 的單一 PR (Rule 19)。建議合併次序：本 repo（契約與範本）先，`aqutter-cli` 次之，下游範本專案最後。

## References
- GitHub Issue `Aqutter/aqutter#1`（說明網站）— 與本計畫無直接依賴；manifest 若選 Q1 的選項 B 才會依賴它。
- 對話中的分析：npm／yarn 無法安裝子目錄依賴的實測、cli 與 client 的耦合程度（最近 60 個 commit 中 11 個同時改到 `cli`／`client` 與 `shell`）。
