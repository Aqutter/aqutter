<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610221548 - plugin-supported-platforms-and-multiplatform-map
- Created: 2026-10-22
- Branch: feature/2610221548-plugin-supported-platforms-and-multiplatform-map
- Issue: 待建立（Phase 2 核准後）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Planning
- Completed: [Wait for Finish]

## Goals
讓 plugin 能宣告自己支援哪些平台：不支援的平台上，網頁用同步的 `isPluginSupported` 就能得知並改走替代方案，不必靠 plugin 自己多加一個 `isSupported` 方法再往返一次（而且那次往返在殼不回應時會卡住）。

## Architecture
殼的 `BridgeRegistry._handle(... supported:)` 已經能「註冊 handler 但不列入 capabilities」（`shell/lib/src/bridge/bridge_registry.dart:248-262`，目前只有核心 handler 的 `_isMobile` 用到）。plugin 的 handler 在 `_registerPlugins`（`:152-170`）一律以預設 `supported = true` 註冊，plugin 沒有宣告平台的入口。本計畫在 `AqutterPlugin` 加 `supportedPlatforms`，由 `_registerPlugins` 依目前平台決定 `supported`，並讓不支援的平台上 plugin 不被呼叫（`attach`、`buildUnderlay`、`buildOverlay`、handler 本身）。

## Cross-Repo Scope
- **共用計畫 ID**: `2610221548-plugin-supported-platforms-and-multiplatform-map`　**共用分支名**: `feature/2610221548-plugin-supported-platforms-and-multiplatform-map`
- **參與 repo 與職責**（一 repo 一 issue，尚未建立者寫 `待建立`）:
  - `Aqutter/aqutter`（契約正本；殼）— `AqutterPlugin.supportedPlatforms`、註冊與不支援時的行為、文件與測試。issue: 待建立
  - `Aqutter/aqutter-plugin-google-maps`（消費方）— 宣告 `supportedPlatforms`，並提供「原生＋JS」的多平台網頁 API。issue: 待建立
  - `Aqutter/aqutter-js`（僅文件註解）— `isPluginSupported` 的說明；執行時另建極小的計畫與 issue。issue: 待建立
- **執行順序相依**: ① `aqutter`（殼的宣告機制）合併，並更新 manifest 的 `shell.ref` 與移動 tag（依既有流程）→ ② `aqutter-plugin-google-maps` 依新殼實作與驗證 → ③ `aqutter-js` 註解（可與 ① 同步）。契約提供方先、消費方後。
- **範圍外**: 不改 plugin 的 id（維持 `google-maps`、套件名 `aqutter-plugin-google-maps`）；不新增 bridge handler；不處理 JS API key 經殼傳遞；不做 Linux／Windows 原生地圖。

- **本計畫所屬 repo**: `Aqutter/aqutter`

## Contract / 介面契約
- **契約正本 repo**: `Aqutter/aqutter`　**修訂號**: `rev 1`　**狀態**: `草擬`

### 1. Dart：`AqutterPlugin.supportedPlatforms`（`Aqutter/aqutter`，`shell/lib/src/plugin/aqutter_plugin.dart`）
| 項目 | 值 |
|---|---|
| 成員 | `Set<TargetPlatform>? get supportedPlatforms => null` |
| 預設 | `null`＝所有平台都支援（現有 plugin 行為不變） |
| 比對 | 以 `defaultTargetPlatform` 與集合比對；`kIsWeb` 時視為不支援 |
| 不支援時 handler | 仍註冊（呼叫不會是 handler not found），**不**列入 `PlatformInfo.capabilities`；被呼叫時**不執行** plugin 的函式，改為回傳錯誤（見第 3 點）而不是卡住 |
| 不支援時 `attach` | 不呼叫 |
| 不支援時 `buildUnderlay`／`buildOverlay` | 不呼叫（視同回傳 null） |
| 不支援時 `dispose` | 仍呼叫（可安全重複釋放） |

### 2. TS：`isPluginSupported(pluginId, method)`（`Aqutter/aqutter-js`，`src/index.ts`）
| 項目 | 值 |
|---|---|
| 行為 | 不變：能力表有 `<id>.<method>` 才為 true；能力表尚未取得時為 true |
| 意義 | 「這個方法在本平台做得到」（支援平台宣告生效後才有此意義）；只改文件註解 |

### 3. 不支援平台上的呼叫
| 情境 | 結果 |
|---|---|
| 網頁對不支援平台的 plugin 方法 `callPlugin` | Promise 被 reject，錯誤訊息含 `UNSUPPORTED_PLATFORM`、plugin id、方法名、目前平台；**不得**無回應（先前 Linux 上 battery 呼叫卡住的教訓） |
| 能否在殼端攔到 | 實作前先驗證「handler 回傳錯誤時網頁端 Promise 會 reject」；若殼的回報通道做不到，退而回傳 `{ "error": "UNSUPPORTED_PLATFORM", … }` 並由 TS `callPlugin` 轉成 reject（屆時走 Rule 29 修改本契約） |

### 4. google-maps 網頁 API（`Aqutter/aqutter-plugin-google-maps`，`src/index.ts`）
| 成員 | 簽章 | 說明 |
|---|---|---|
| `googleMaps.configure(options)` | `{ jsApiKey?: string }` → `void` | 設定非原生平台用的 Google Maps JS API key；由使用端 App 傳入，plugin 不讀檔案、不寫入 repo。須在 `mount` 前呼叫；原生平台忽略 |
| `googleMaps.provider()` | `() => 'native' \| 'js'` | 同步：`isPluginSupported('google-maps', 'moveTo')` 為 true 回 `'native'`，否則 `'js'` |
| `googleMaps.mount(container, options?)` | `(HTMLElement, { camera?: { lat, lng, zoom? }, mapType? }) → Promise<GoogleMapsView>` | `'native'`：在 container 內建立 `<aqutter-native session="google-maps">`；`'js'`：載入 Google Maps JS API 並在 container 內建立地圖。兩者都讓使用端可在 container 內疊任何 HTML |
| `GoogleMapsView` | `provider`、`getCamera()`、`moveTo(lat, lng, { zoom?, animate? })`、`setMarkers(markers)`、`setMapType(type)`、`onReady/onCameraIdle/onTap(listener) → unsubscribe`、`destroy()` | 方法與事件的型別沿用現有 `GoogleMapsCamera`、`GoogleMapsMarker`、`GoogleMapsType`；兩種 provider 行為一致 |
| 移除 | 頂層的 `isSupported`、`getCamera`、`moveTo`、`setMarkers`、`setMapType`、`onReady`、`onCameraIdle`、`onTap` | 開發階段破壞式移動；改由 `mount` 回傳的 `GoogleMapsView` 提供。`define()`、`element()` 保留 |
| 缺 key | `provider()==='js'` 且未 `configure({ jsApiKey })` | `mount` reject，訊息指出要呼叫 `configure` |
| JS 載入失敗 | 腳本載入失敗或逾時（預設 15 秒） | `mount` reject，不得無回應 |

### 5. CSP 與 key（文件義務，`Aqutter/aqutter-plugin-google-maps` README）
- 非原生平台載入 Google Maps JS API，網頁的 CSP 需放行 Google 的腳本、圖磚、樣式與字型來源（確切網域於實作時以實測為準，不在此臆測）。
- JS API key 與原生 SDK key 是**不同**的 key；release 版網頁來源為 `http://127.0.0.1:<隨機埠>`，key 的網址（referrer）限制怎麼填**尚未驗證**，實作時實測並記入 README。

### 6. 相容性
- 現有 plugin 不覆寫 `supportedPlatforms`，行為不變。
- google-maps 的頂層 API 是破壞式移除（使用者指示：開發階段不考慮既有程式），範本專案目前沒有使用地圖。

### 7. 變更紀錄
- _(尚無)_

## Impact Files
- `shell/lib/src/plugin/aqutter_plugin.dart:41-69`（`AqutterPlugin`）— 新增 `supportedPlatforms`，並更新類別文件註解。
- `shell/lib/src/bridge/bridge_registry.dart:152-170`（`_registerPlugins`）— 依平台決定 `supported`；不支援時不呼叫 `attach`，handler 改為回傳 `UNSUPPORTED_PLATFORM` 錯誤。`:248-262`（`_handle`）— 視需要擴充以支援「不支援時替換函式」。
- `shell/lib/src/app.dart:757,762`（`buildUnderlay`／`buildOverlay` 的迴圈）— 不支援平台的 plugin 略過。
- `shell/test/plugin_test.dart` — 新增：支援／不支援平台的 handler 註冊、capabilities、`attach` 與 slot 是否被呼叫、被呼叫時的錯誤。
- `docs/plugins.md` — 「Dart 端」與「網頁端與型別」兩節補 `supportedPlatforms` 與網頁分支寫法。
- `docs/plugins.md:105`（「呼叫可能永遠不回應」）— 補一句：宣告支援平台後，不支援的呼叫會明確失敗而不是卡住。

## Open Questions / 待確認事項
無（Q1 至 Q4 已確認，見 Key Decisions）。
- ⏳ **實作前驗證項（非決策）**：契約第 3 點「handler 回傳錯誤時網頁端 Promise 會 reject」需先實測；做不到時依 Rule 29 修改契約。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 更新 manifest `manifest/releases.json` 的 `shell.ref` 為新 sha，並移動 `aqutter` 的 tag `0.0.0`（與 manifest 的 sha 一致）；同步 `aqutter-cli` 的內建快照 — 沿用先前流程 — 對外動作，需使用者核准。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；milestone 不指定，base 為 `main`（逐 repo 詢問，皆選不指定）。
- **[Q1]** 宣告粒度＝plugin 層級的 `supportedPlatforms`（使用者選擇，建議項）— 理由：最簡單，殼已有 `_handle(supported:)` 機制可重用；每個方法各自宣告改動 `AqutterPlugin` 介面較大。
- **[Q2]** 非原生平台用 Google Maps JavaScript API（使用者選擇，未採納建議的 MapLibre）— 後果：需另一組 JS API key、計費、必須從 Google 載入腳本（無法離線）、release 的來源是隨機埠，key 的網址限制怎麼填待驗證。
- **[Q3]** plugin 名稱維持 `aqutter-plugin-google-maps`（使用者選擇）— 理由：JS 引擎選了 Google，名稱與行為一致。
- **[Q4]** JS API key 由網頁端 `googleMaps.configure({ jsApiKey })` 傳入（使用者選擇，建議項）— 理由：plugin 不讀檔案、不寫 key 進 repo，與原生端「key 由使用端設定」一致；不新增 bridge handler。
- **[設計]** 地圖 plugin 自己提供多平台能力（使用者指示）：原生（iOS/Android）與 JS（其他平台）在 plugin 內由 `mount` 依 `provider()` 切換，使用端只寫一份。
- **[破壞式]** 開發階段不考慮既有程式（使用者指示）：google-maps 頂層 API 直接移除。
- **[執行模式]** 序列。**[完成後]** 待核准閘決定。

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定；commit 與 PR body 含 `Closes #N`。
- commit 自動；完成時依核准閘的「完成後」選項。

## References
- `Aqutter/aqutter#9`（dev 模式重試）、Linux 驗證時發現的「呼叫永遠不回應」（`docs/linux.md`）
