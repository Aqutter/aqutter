# 原生功能

## Summary
殼把網頁最常需要的四個原生能力直接內建在 bridge：剪貼簿（文字與圖片）、系統分享（文字、網址、檔案）、本機通知與深層連結，網頁不必另外安裝 plugin。文字剪貼簿與分享在所有平台可用；圖片剪貼簿在 Android、iOS、macOS、Windows，通知與連結在 Android、iOS、macOS。通知不自動要權限，排程為非精確；啟動 App 的連結與由通知冷啟的資訊都由網頁主動讀取，不走事件。通知不需要改原生專案；連結的 scheme 與網域屬於各 App。

## 運作方式

### 通知與連結如何到達網頁

這張圖回答：App 被關掉時點通知或連結，網頁怎麼拿到資訊？App 執行中又是怎麼送達的？

```json diagram id=送達
{
  "type": "sequence", "title": "通知與連結如何到達網頁", "desc": "冷啟時網頁就緒後主動讀取；執行中由殼以事件推送",
  "actors": ["使用者", "殼", "網頁"],
  "steps": [
    {"from": "使用者", "to": "殼", "text": "點通知或開連結（App 已關閉）"},
    {"from": "殼", "to": "殼", "text": "記下啟動資訊"},
    {"from": "網頁", "to": "殼", "text": "就緒後讀取啟動連結與通知"},
    {"from": "殼", "to": "網頁", "text": "回傳啟動資訊", "reply": true},
    {"from": "使用者", "to": "殼", "text": "點通知或開連結（App 執行中）"},
    {"from": "殼", "to": "網頁", "text": "推送新資訊", "emit": "deep_link"},
    {"from": "網頁", "to": "網頁", "text": "驗證後導航"}
  ]
}
```

![通知與連結如何到達網頁](native-features.送達.svg)

1. 通知與連結的服務在殼啟動時就開始運作，不必等網頁。
2. App 被關掉後由通知或連結啟動時，殼記下那一筆資訊，不以事件送出。
3. 事件在網頁尚未連線時會被丟棄，所以冷啟的資訊改由網頁就緒後主動讀取，可重複讀取且內容一致。
4. App 執行中收到新的通知點擊或連結，殼以事件推送。
5. 部分平台的連結串流會把啟動連結再送一次，殼把這個重複的第一筆濾掉。
6. 殼不檢查連結內容，網頁要自行驗證再導航。

來源：1. [bridge_registry.dart](../../../shell/lib/src/bridge/bridge_registry.dart)　2. [deep_link_service.dart](../../../shell/lib/src/bridge/deep_link_service.dart)　3. [notification_service.dart](../../../shell/lib/src/bridge/notification_service.dart)

## 規則

| 規則 | 說明 |
|---|---|
| 剪貼簿文字 | 上限一百萬字；讀取是明確呼叫，沒有背景監聽 |
| 剪貼簿圖片 | 寫入 PNG 或 JPEG（位元組開頭須與宣告相符），讀出一律是 PNG；上限 5 MiB，讀到更大的回 too_large；由殼自己的原生程式實作，不依賴外部套件，Linux 不支援 |
| 分享 | 文字、網址、檔案至少一個有內容；文字與網址合成一段；檔案最多 5 個、每個 5 MiB，檔名須是單一檔名；殼暫存後交給系統並盡力刪除 |
| 通知權限 | 不自動要求；未授權時回 permission_denied，網頁先用權限 handler 取得 |
| 通知排程 | 以絕對時間點排程、必須晚於現在；非精確，系統可能延後數分鐘 |
| 通知編號 | 省略時從 1 遞增配發；同編號再次顯示會取代原通知；殼重啟後配發重來 |
| 通知內容上限 | 標題 200、內文 2,000、附帶字串 1,000，超過拒絕、不截斷 |
| 不支援的平台 | 通知與連結在 Windows、Linux、圖片剪貼簿在 Linux 不列入能力表，呼叫回 UNSUPPORTED_PLATFORM |
| 通知的原生設定 | 不需要：接收器、開機重新排程與通知代理都由殼自己實作與宣告，不依賴外部通知套件 |
| 重開機後（Android） | 尚未到時間的排程通知重新排上，已過時間的不補發；iOS 同時最多 64 則待送通知 |
| 連結的原生設定 | scheme 與網域屬於各 App，CLI 升級不會改 |

來源：1. [native_features.dart](../../../shell/lib/src/bridge/native_features.dart)　2. [native-features.md](../../../docs/native-features.md)

## 錯誤與提示

| 文案 | 條件 | 處置 |
|---|---|---|
| 參數不合法 | 欄位缺漏、型別錯、超過上限、排程時間已過、圖片格式與宣告不符 | 修正參數，不要重試 |
| 圖片太大 | 剪貼簿裡的圖片超過 5 MiB | 改用較小的圖片，不要重試 |
| 通知權限未授權 | 顯示或排程時沒有 notifications 權限 | 先要求權限；永久拒絕時引導到系統設定 |

來源：1. [native_features.dart](../../../shell/lib/src/bridge/native_features.dart#L1-L40)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
