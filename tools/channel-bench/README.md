# channel-bench：網頁、Flutter、原生之間的通道基準

量「網頁 <-> Flutter」各條通道的延遲與吞吐，以及把「慢」隔離到哪一層。結果與解讀見 [docs/channel-performance.md](../../docs/channel-performance.md)，原始數字在 [results/](results)。

這是**開發用工具**，不是框架的一部分，也不會被打包進任何 App。

## 內容

| 位置 | 用途 |
|---|---|
| `app/bench_plugin.dart` | App 內的 Dart plugin（`id = bench`）：`ping`、`echo`、`startEvents`、`startWs`（本機 WebSocket，關閉壓縮）、`report`（把結果寫成檔案並印到 logcat） |
| `app/zzbench.client.ts` | 網頁端的基準（Nuxt 的 client plugin，載入後 10 秒自動執行）：A 小呼叫往返、B 吞吐、C JSON 酬載、D base64 二進位、E 事件、F WebSocket 二進位 |
| `app/zzmirror.client.ts` | 鏡像基準（載入後 12 秒自動執行）：用 `mirror-demo` 的 `animate` 讓畫面每一幀都在變，量 fps、每幀大小與頻寬 |
| `isolate/ws_server.dart`、`ws_page.html`、`ws_client_node.mjs`、`ws_client_dart.dart` | 獨立的 WebSocket 伺服器與三種客戶端（一般瀏覽器、Node、Dart），不依賴 Flutter，用來隔離「慢」在伺服器、WebView 還是 Chromium |
| `app/zzchan.client.ts`、`app/channel_bench_plugin.dart` | 統一傳輸的端對端驗證與量測：小呼叫、二進位往返、base64 對照、事件、錯誤碼、伺服器重啟後的重連 |
| `results/` | 2026-10-27 的原始結果（Windows、Android、Windows 鏡像三種政策） |

## 在 App 裡跑（release 版才有意義）

1. 在一個已有 `mirror-demo` plugin 的 App 專案，把 `app/bench_plugin.dart` 複製到 `aqutter/lib/`，並在 `aqutter/lib/aqutter_plugins.dart` 加上 `BenchPlugin()`。
2. 把 `app/zzbench.client.ts`（或 `app/zzmirror.client.ts`）複製到網頁專案的 `app/plugins/`（一次只放一個）。
3. 建置 release 版並啟動。
4. 取得結果：
   - Windows：`%TEMP%\aqutter_chbench.json`。
   - Android（release 讀不到檔案）：`adb logcat -d -s flutter | grep CHBENCH`，去掉 `CHBENCH ` 前綴後就是 JSON，到 `CHBENCH_END` 結束。
   - 其他平台：結果檔在 `Directory.systemTemp` 底下的 `aqutter_chbench.json`；同樣會印到標準輸出。

鏡像基準想比較三種解析度政策時，在 `aqutter_plugins.dart` 讓 `MirrorDemoPlugin(quality: …)` 讀環境變數（`smooth`／`sharp`／`auto`），不用重建就能換；`report` 會把環境變數 `MIRROR_QUALITY` 寫進結果。

## 隔離 WebSocket 的慢

```bash
dart run tools/channel-bench/isolate/ws_server.dart 8765
node tools/channel-bench/isolate/ws_client_node.mjs 8765
dart run tools/channel-bench/isolate/ws_client_dart.dart 8765
```

用一般瀏覽器開 `http://127.0.0.1:8765/`，頁面會跑同一份測試。想換伺服器實作時加 `?target=127.0.0.1:<埠>`（例如自己啟動的 Node `ws` 伺服器）。

## 注意

- 單機單次量測，數字當量級看；高階手機與桌機不代表中低階裝置。
- 結果依賴機器負載，跑之前關掉其他重的程式。
- 工具會在本機開 loopback 埠，測完請關掉伺服器。
