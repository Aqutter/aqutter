# 通道效能

網頁、Flutter、原生三層之間有幾條資料通道，各自快慢差很多。這份文件記錄 2026-10-27 的量測、解讀與限制，工具與原始結果見 [tools/channel-bench](../tools/channel-bench)。

> **先看限制**：每個平台一台機器、各跑一次的 release 版；Android 是一支高階手機（ASUS_I006D，Android 13），Windows 是 22 核心的桌機（WebView2 / Chromium 155）。**iOS、macOS、Linux 沒有量。**數字只當量級參考，不要當規格。

## 通道

| 通道 | 做法 | 適合 |
|---|---|---|
| 呼叫（網頁 → Flutter） | `callHandler(name, payload)`：酬載 JSON 字串化，原生層解碼，結果再回傳 | 一般功能呼叫 |
| 事件（Flutter → 網頁） | `evaluateJavascript("window.__flutterBridgeEmit(頻道, payload)")`：每個事件組成一段 JS 字串去執行 | 低頻通知 |
| 大型二進位 | 放進 JSON，用 base64 | 偶爾的小檔案 |
| 本機 WebSocket | 殼內的 `AqutterNativeHost`（鏡像使用）；二進位訊息、關閉壓縮 | 鏡像的幀；大量二進位 |
| 統一傳輸（現行） | 呼叫、回應、事件與二進位共用一條本機 WebSocket（`aqutter.rpc`）；酬載可直接帶 `Uint8List`／`Uint8Array`（見 [plugins](plugins.md)） | 全部 |

## 結果（release，各一次）

| 項目 | Windows | Android |
|---|---|---|
| **A. 小呼叫往返**（平均／p95） | 0.48 ／ 0.6 ms | 0.53 ／ 0.7 ms |
| **B. 小呼叫吞吐**（每批 100 個同時） | 8,104 次/秒 | 3,665 次/秒 |
| **C. JSON 往返 1KB／64KB** | 1.05 ／ 6.8 ms | 0.62 ／ 4.3 ms |
| **C. JSON 往返 1MB**（有效頻寬） | 97.8 ms（約 20 MB/s） | 52.0 ms（約 38 MB/s） |
| **C. JSON 往返 4MB** | 368.5 ms | 202.4 ms |
| **D. base64 二進位 1MB 往返**（編碼／呼叫／解碼） | 134 ms（34／95／5） | 133 ms（51／76／6） |
| **E. 事件，循序，100B** | 1,484 個/秒 | 1,391 個/秒 |
| **E. 事件，連發，100B** | 25,485 個/秒 | 23,729 個/秒 |
| **E. 事件，循序，500KB** | 39 個/秒 | 79 個/秒 |
| **F. WebSocket 1MB 下行**（Dart → 網頁） | 44 MB/s | 263 MB/s |
| **F. WebSocket 1MB 上行** | 60 MB/s | 147 MB/s |
| **F. WebSocket 64B 小訊息下行** | 2,873 則/秒 | 39,108 則/秒 |
| **F. WebSocket 64B 小訊息上行** | 20,901 則/秒 | 21,135 則/秒 |

D 的 base64 編碼用的是一般寫法（`String.fromCharCode` 加 `btoa`），沒有刻意最佳化，所以編碼那一欄要保守看。

## 解讀

- **小呼叫很快**：往返約 0.5 ms，兩個平台一樣。一般功能呼叫不需要優化。
- **大型二進位走 JSON 或 base64 很慢**：1MB 要 50 到 130 ms，有效頻寬約 20 到 40 MB/s。base64 還多 33% 體積與編碼成本。
- **本機 WebSocket 傳二進位快很多**：Android 上 1MB 下行 263 MB/s，約是 JSON 路徑的 7 倍；Windows 上 44 到 60 MB/s，約 2 到 3 倍。
- **事件**：連發的小事件快（約 2.4 萬個/秒），循序等待的慢（約 1,400 個/秒）；大酬載的事件受限於同一條 JSON 字串路徑（500KB 約 39 到 79 個/秒）。

## Windows 的 WebSocket 下行上限

Windows 上 WebSocket 下行明顯比 Android 慢（1MB：44 對 263 MB/s；64B 小訊息：2,873 對 39,108 則/秒）。用同一組測試換客戶端與伺服器隔離：

| 客戶端 → 伺服器 | 1MB 下行 | 64B 小訊息下行 |
|---|---|---|
| WebView2 → App 內 `dart:io`（原始量測） | 44 MB/s | 2,873 則/秒 |
| 一般瀏覽器（Chromium 152）→ `dart:io` | 48.8 MB/s | 4,937 則/秒 |
| 一般瀏覽器 → Node `ws` | 38.6 MB/s | 21,533 則/秒 |
| Node 客戶端 → `dart:io` | **97 MB/s** | 7,387 則/秒 |
| Dart 客戶端 → `dart:io` | 82 MB/s | 4,215 則/秒 |

另外，瀏覽器下行不管訊息大小（64KB 到 16MB）、`binaryType`（`arraybuffer` 或 `blob`）、伺服器是 Dart 或 Node，都在約 33 到 62 MB/s。

**結論**：Windows 上 **Chromium（包含 WebView2）的 WebSocket 下行上限約 50 MB/s**，與伺服器實作、訊息大小、`binaryType` 無關；同一台機器上 Node 與 Dart 客戶端能到 80 到 97 MB/s，所以不是 Windows 的 TCP，也不是 `dart:io` 伺服器。這個上限在 Chromium 內部，我們改不動。小訊息下行的速率則會隨伺服器實作變（Dart 約 5 千則/秒、Node 約 2 萬則/秒）。

**對策**：想在 Windows 傳大量資料給網頁，就要減少位元組（壓縮、降解析度、縮小資料）；把資料切成較小或較大的訊息沒有幫助。WebView2 另有自己的二進位機制（例如共享緩衝區），`aqutter_core` 是否能用沒有驗證，**不要當成可用的選項**。

## Windows 鏡像：兩個上限

鏡像每一幀都經過這條 WebSocket。用 `mirror-demo` 的 `animate`（整個畫面每一幀都在變）在 Windows release 版量三種解析度政策各 10 秒（元素 1100×320、dpr 1.25）：

| `quality` | fps | 每幀大小 | 頻寬 | 平均延遲 |
|---|---|---|---|---|
| `auto`（預設） | 29.3 | 1,673 KB | **47.9 MB/s** | 78 ms |
| `smooth` | **36.1** | 344 KB | 12.1 MB/s | 15 ms |
| `sharp` | 16.5 | 2,148 KB | 34.6 MB/s | 154 ms |

- `auto` 的頻寬正好貼著 WebSocket 下行上限：**大幀時，上限是這條通道**（約 30 fps）。
- `smooth` 每幀小 5 倍、頻寬遠低於上限，fps 只升到 36：此時換成**畫面讀回**卡住（先前量到每幀 `toImage` 加 `toByteData` 約 22 到 28 ms，對應約 36 到 45 fps）。
- `sharp` 每幀最大、延遲最高，連上限都沒用滿，表示全解析度的擷取本身更貴。

所以 Windows 上的鏡像在 `auto` 約 30 fps、`smooth` 約 36 fps；想更高就要同時降低每幀位元組與擷取成本。移動中降解析度是刻意的設計（見 [Native view 鏡像](nativeview.md)）。

## 統一傳輸（Android 實機）

呼叫與事件改走同一條多工連線後，在同一支 Android 手機（release）以真實的 plugin 與 `callPlugin` 量測。原始結果與測試程式在 `tools/channel-bench/results/android-asus-i006d-unified-transport-2026-10-27.json`、`app/zzchan.client.ts`、`app/channel_bench_plugin.dart`。

| 項目 | 結果 |
|---|---|
| 小呼叫往返（300 次） | 平均 0.57 ms，p95 1.1 ms（改版前 `callHandler` 約 0.5 ms） |
| 2MB 二進位來回 | 內容一致 |
| **1MB 往返：二進位對 base64（同一條傳輸）** | **15.5 ms 對 100.1 ms，約 6.5 倍** |
| 1MB 下行 × 100（逐一呼叫） | 134 MB/s |
| 1MB 上行 × 100（逐一呼叫） | 121 MB/s（Dart 端收到 104,857,600 位元組） |
| 事件帶 100KB 二進位 × 200 | 200 個全數收到，114 ms |
| 錯誤碼 | `HANDLER_NOT_FOUND`、`HANDLER_FAILED`、plugin 自訂 `DENIED` 皆正確 |
| 殼重啟伺服器 | 進行中的呼叫 `TRANSPORT_CLOSED`，狀態 closed → connecting → open，約 217 ms 後呼叫恢復 |

- Android：小呼叫沒有變慢（0.57 對 0.5 ms，量測誤差內）；大資料的好處是實測的。
- 下行／上行的吞吐低於先前直接用 WebSocket 量到的數字（約 260／190 MB/s）：這裡每次是一個完整的呼叫往返（編碼、分派、回應），不是連續串流。
- 只在這一支 Android 手機、一台 Windows 桌機與 WSL2 的 Linux 量過各一次；iOS 見下方「iOS（iPad 實機與模擬器）」，macOS 追蹤於 Aqutter/aqutter#21。
- 另外用 70 MiB 的呼叫來回（內容一致，902 ms）、66 MiB 的事件（收到）、超過 512 MiB（`PAYLOAD_TOO_LARGE`）驗證自動分段。

### Windows（同一套測試）

原始結果：`tools/channel-bench/results/windows-unified-transport-2026-10-27.json`。

| 項目 | 結果 |
|---|---|
| 小呼叫往返（300 次） | 平均 0.79 ms，p95 1.2 ms（改版前 `callHandler` 約 0.48 ms，**慢了約 0.3 ms**） |
| 1MB 往返：二進位對 base64（同一條傳輸） | 45.3 ms 對 121.9 ms（約 2.7 倍） |
| 1MB 下行／上行 × 100（逐一呼叫） | 57／46 MB/s |
| 事件帶 100KB 二進位 × 200 | 全數收到，369 ms |
| 70 MiB 呼叫來回／66 MiB 事件／超過 512 MiB | 內容一致（2.66 秒）／收到／`PAYLOAD_TOO_LARGE` |
| 錯誤碼、殼重啟後的重連 | 皆正確；約 216 ms 後呼叫恢復 |

- Windows 的好處比 Android 小（2.7 倍對 6.5 倍），因為 Chromium 的 WebSocket 下行上限約 50 MB/s（見上方「Windows 的 WebSocket 下行上限」），這條傳輸同樣受限。
- 小呼叫在 Windows 慢了約 0.3 ms：一般呼叫不受影響，但每次呼叫都有這個固定成本。
- 只在這一台 Windows 桌機量過一次。

### Linux（WSL2 Debian 13，WPE WebKit 2.48.3）

原始結果：`tools/channel-bench/results/linux-wsl2-debian13-unified-transport-2026-10-27.json`。

| 項目 | 結果 |
|---|---|
| 小呼叫往返（300 次） | 平均 3.57 ms，p95 12 ms（比 Android、Windows 高很多） |
| 1MB 往返：二進位對 base64（同一條傳輸） | 18.9 ms 對 148.8 ms（約 7.9 倍） |
| 1MB 下行／上行 × 100（逐一呼叫） | 112／117 MB/s |
| 事件帶 100KB 二進位 × 200 | 全數收到，52 ms |
| 70 MiB 呼叫來回／66 MiB 事件／超過 512 MiB | 內容一致（0.99 秒）／收到／`PAYLOAD_TOO_LARGE` |
| 錯誤碼、殼重啟後的重連 | 皆正確；約 212 ms 後呼叫恢復 |

- 功能全部通過。小呼叫的延遲高是在 WSL2 + WPE WebKit 環境量到的，沒有與改版前的 `callHandler` 對照過，不能說是統一傳輸造成的；真實的 Linux 桌機沒有量。
- 只量過這一個環境一次。

### iOS（iPad 實機與模擬器）

原始結果：`tools/channel-bench/results/ios-ipad-a16-unified-transport-2026-10-27.json`（實機）、`ios-simulator-ipad-pro-13-m5-unified-transport-2026-10-27.json`（模擬器）。

- 實機：iPad（A16，iPad15,7），iOS 27.0.1，**release** 版。
- 模擬器：iPad Pro 13 吋（M5），iOS 26.5，用 `aqutter dev` 跑的 **debug** 版（不是 release，數字只能當對照）。
- 測試程式與 Android 相同（`channel_bench_plugin.dart`、`zzchan.client.ts`）；放進 demo-app 時 plugin id 改成 `chbench`，避免與 demo 既有的 `bench` plugin 撞名。release 版讀不到 console，結果檔寫在 App 容器的 `tmp/aqutter_chbench.json`，用 `xcrun devicectl device copy from --domain-type appDataContainer` 取回。

| 項目 | 實機（release） | 模擬器（debug） |
|---|---|---|
| 小呼叫往返（300 次） | 平均 0.96 ms，p95 1 ms | 平均 0.63 ms，p95 1 ms |
| 2MB 二進位來回 | 內容一致 | 內容一致 |
| **1MB 往返：二進位對 base64（同一條傳輸）** | **7.95 ms 對 44.5 ms，約 5.6 倍** | 6.8 ms 對 39.6 ms，約 5.8 倍 |
| 1MB 下行 × 100（逐一呼叫） | 730 MB/s | 334 MB/s |
| 1MB 上行 × 100（逐一呼叫） | 431 MB/s（Dart 端收到 104,857,600 位元組） | 227 MB/s（同） |
| 事件帶 100KB 二進位 × 200 | 200 個全數收到，20 ms | 200 個全數收到，20 ms |
| 錯誤碼 | `HANDLER_NOT_FOUND`、`HANDLER_FAILED`、plugin 自訂 `DENIED` 皆正確 | 同 |
| 殼重啟伺服器 | 進行中的呼叫 `TRANSPORT_CLOSED`，狀態 closed → connecting → open，約 209 ms 後呼叫恢復 | 同，約 213 ms |

- 功能全部通過：WKWebView 內的頁面連得上 `ws://127.0.0.1:<埠>/channel/aqutter.rpc`（頁面來源是殼的本機 server，沒有被混合內容或 App Transport Security 擋掉）。
- 小呼叫在實機約 1 ms（Android 0.57 ms、Windows 0.79 ms），二進位的好處（約 5.6 倍）介於 Windows 與 Android 之間。
- 實機的下行／上行吞吐（730／431 MB/s）高於 Android 與 Windows；單次量測，不確定差距的原因，不要當成各平台的穩定排序。
- 「殼重啟伺服器」是 bench 叫殼直接呼叫 `restart()`；實際按 Home 或鎖屏後回前景的重連，只在模擬器上手動確認過，實機沒有量。
- 結果裡的 `platform` 是 `Macintosh; Intel Mac OS X 10_15_7`：iPadOS 的 WKWebView 預設使用桌面版 UA，不是量到 Mac。
- 只在一台 iPad 與一個模擬器各量過一次。

## 限制

- 單機單次，Android 是高階手機；中低階裝置的差距可能更大。
- macOS 與真實的 Linux 桌機沒有量；iOS 只量過一台 iPad 與其模擬器各一次。需要這些平台的數字，請用 [tools/channel-bench](../tools/channel-bench) 在那些平台重跑。
- 鏡像實驗只用 `mirror-demo` 的 `animate` 壓力測試，不代表一般使用情境。
- 「Chromium 在 Windows 的 WebSocket 下行上限」是在這台機器上量到的現象，沒有追到 Chromium 內部的原因。
