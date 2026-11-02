# plugin 註冊

## Summary
殼在啟動時把內建 plugin 與 App 傳入的清單合併後逐一註冊；清單裡可以是現成的 plugin，也可以是會建立 plugin 的工廠，工廠能帶參數、能非同步，並從啟動 context 取得偏好設定、支援目錄與平台。工廠依清單順序逐一執行，每個最長三十秒，任何一個失敗整個啟動就失敗並指出是哪一個。真正的註冊只發生在 Dart 層；網頁端只用名稱呼叫，型別是選配。CLI 負責產生總清單與每個 plugin 的使用者檔案，客製寫在後者。

## 運作方式

### plugin 從清單到可用

這張圖回答：App 傳入的清單怎麼變成網頁可以呼叫的 plugin？

```json diagram id=註冊流程
{
  "type": "flow", "dir": "TD", "title": "plugin 從清單到可用", "desc": "啟動時先解析工廠，成功才註冊並掛上畫面",
  "nodes": [
    {"id": "a", "text": "殼啟動", "kind": "start"},
    {"id": "b", "text": "依清單順序\n逐一處理"},
    {"id": "c", "text": "是工廠？"},
    {"id": "d", "text": "執行工廠\n（最長 30 秒）", "key": true},
    {"id": "e", "text": "成功？"},
    {"id": "f", "text": "啟動失敗\n錯誤畫面指出是誰", "kind": "failure"},
    {"id": "g", "text": "檢查 id\n註冊方法與事件"},
    {"id": "h", "text": "掛上畫面並\nattach", "kind": "success"}
  ],
  "edges": [
    {"from": "a", "to": "b"},
    {"from": "b", "to": "c"},
    {"from": "c", "to": "d", "label": "是"},
    {"from": "c", "to": "g", "label": "現成的 plugin"},
    {"from": "d", "to": "e"},
    {"from": "e", "to": "f", "label": "例外或逾時", "kind": "fail"},
    {"from": "e", "to": "g", "label": "是"},
    {"from": "g", "to": "h"}
  ]
}
```

![plugin 從清單到可用](plugin-registration.註冊流程.svg)

1. 殼先把內建 plugin 放在前面，再接上 App 傳入的清單。
2. 清單依序處理；現成的 plugin 直接採用，工廠則等它完成再往下。
3. 工廠失敗或逾時，整個啟動停在既有的錯誤畫面，並寫出是哪個 plugin、什麼原因；不會略過它繼續。
4. 全部解析完才檢查 id（格式、保留字、與內建同名、重複）並註冊 handler 與事件。
5. 會畫在畫面上的 plugin 在解析完成後才掛上，啟動過場仍蓋著。

來源：1. [plugin_entry.dart](../../../shell/lib/src/plugin/plugin_entry.dart)　2. [app.dart](../../../shell/lib/src/app.dart)　3. [bridge_registry.dart](../../../shell/lib/src/bridge/bridge_registry.dart)

### 檔案由誰管

新增 plugin 後，哪些檔案由 CLI 改、哪些是使用者的：

| 檔案 | 誰管 | 說明 |
|---|---|---|
| 總清單 | CLI，每次重寫 | 工廠的列表，請勿手改 |
| 每個 plugin 一個的檔案 | 使用者，CLI 只在不存在時建立 | 建立該 plugin 的函式，客製寫在這裡 |
| App 的 main | 使用者 | 只傳入總清單，增減 plugin 不用改 |

來源：1. [plugins.md](../../../docs/plugins.md)　2. [cli.md](../../../docs/cli.md)

## 規則

| 規則 | 說明 |
|---|---|
| 清單型別 | 現成的 plugin 與工廠可以混用；原本傳現成 plugin 清單的寫法不用改 |
| 啟動 context | 提供偏好設定、支援目錄與平台；不是畫面的建構 context |
| 編譯期的 env | 不經由 context，工廠內直接讀編譯期常數 |
| 執行順序 | 依清單順序逐一，不平行 |
| 逾時 | 每個工廠最長三十秒 |
| 失敗政策 | 任何一個失敗整個啟動失敗，不略過 |
| 畫面上的 plugin | 要用畫面資源請在建立畫面或就緒的回呼裡取得，不要在工廠裡 |
| 網頁端 | 只用名稱呼叫，不需要註冊；型別是選配 |

來源：1. [plugin_entry.dart](../../../shell/lib/src/plugin/plugin_entry.dart#L1-L40)

## 錯誤與提示

| 文案 | 條件 | 處置 |
|---|---|---|
| plugin 初始化失敗 | 工廠丟例外或超過三十秒 | 依訊息修正該 plugin 的建立函式；非同步資源不要卡住 |
| 重複的 plugin id | 清單裡兩個 plugin 同名，或與內建同名 | 移除或改名其中一個 |

來源：1. [plugin_entry.dart](../../../shell/lib/src/plugin/plugin_entry.dart#L48-L95)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
