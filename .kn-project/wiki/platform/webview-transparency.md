# WebView 透明

## Summary
殼讓 WebView 只在有穿透中的原生內容時透明：穿透模式把原生內容（例如地圖）畫在 WebView 下面，WebView 不透明就看不到它。殼監聽核心提供的穿透工作階段數，大於 0 時 WebView 透明，回到 0 時還原，所以啟動與沒有穿透的畫面不會露出底層。切換失敗時殼通知核心，之後的模式協商一律退回鏡像。

## 運作方式

### 透明的切換

這張圖回答：什麼時候 WebView 變透明、什麼時候還原？

```json diagram id=透明的切換
{
  "type": "flow", "dir": "TD", "title": "透明的切換", "desc": "穿透工作階段數大於 0 時 WebView 透明，回到 0 時還原；切換失敗通知核心退回鏡像",
  "nodes": [
    {"id": "a", "text": "穿透工作階段數改變", "kind": "start"},
    {"id": "b", "text": "有穿透中的工作階段?"},
    {"id": "c", "text": "WebView 設為透明", "key": true},
    {"id": "d", "text": "WebView 還原不透明"},
    {"id": "e", "text": "通知核心\n之後一律鏡像", "kind": "ext"}
  ],
  "edges": [
    {"from": "a", "to": "b"},
    {"from": "b", "to": "c", "label": "是"},
    {"from": "b", "to": "d", "label": "否"},
    {"from": "c", "to": "e", "label": "套用失敗", "kind": "fail"},
    {"from": "d", "to": "e", "label": "套用失敗", "kind": "fail"}
  ]
}
```

![透明的切換](webview-transparency.透明的切換.svg)

1. 核心依模式協商的結果計算目前穿透中的工作階段數，數字改變時通知殼。
2. WebView 建立時就依目前的數字決定初始透明，之後只補差異。
3. 數字大於 0 就把 WebView 設為透明，回到 0 就還原。
4. 一次只做一個套用，做完再比對最新需求，快速的來回切換不會讓請求交錯。
5. 套用失敗只通知核心一次並停止重試，直到下一個 WebView 掛上才重來。

來源：1. [webview_transparency.dart](../../../shell/lib/src/webview_transparency.dart)　2. [app.dart](../../../shell/lib/src/app.dart)

## 規則

| 項目 | 說明 |
|---|---|
| 透明的時機 | 只在有穿透中的工作階段時，不是全域常開 |
| 設定的套用 | 執行期改透明時傳整份設定，與建立時同一份，避免其他欄位被重設成預設值 |
| WebView 重掛 | 重掛前先停止套用舊的控制器，新的掛上後以建立時的狀態為基準 |
| 套用失敗 | 通知核心之後的協商一律退回鏡像，原因為無法透明 |
| 頁面條件 | 元素後方的祖先不可有不透明背景，見 [Native view 文件](../../../docs/nativeview.md) |

來源：1. [webview_transparency.dart](../../../shell/lib/src/webview_transparency.dart)　2. [nativeview.md](../../../docs/nativeview.md)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
