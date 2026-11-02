# 權限入口

## Summary
殼是系統權限與網頁授權的唯一出入口：網頁的權限 handler 與 plugin 都向殼的權限服務查詢、要求權限，不必各自相依權限套件。WebView 的相機與麥克風授權（`getUserMedia`）也由殼決定，只放行殼自己供應的頁面，並且要求的資源必須全部在設定的放行清單內，預設是相機與麥克風。系統層的使用者授權仍是前提，殼放行只代表不擋。

## 運作方式

### 網頁取得相機的兩道關卡

這張圖回答：網頁呼叫相機時，殼在哪兩個地方把關？

```json diagram id=相機關卡
{
  "type": "flow", "dir": "TD", "title": "網頁取得相機的兩道關卡", "desc": "先過殼的放行條件，再看作業系統是否授權",
  "nodes": [
    {"id": "a", "text": "網頁要求相機", "kind": "start"},
    {"id": "b", "text": "頁面來源是\n殼自己供應的？", "key": true},
    {"id": "c", "text": "要求的資源\n都在放行清單內？", "key": true},
    {"id": "d", "text": "作業系統\n已授權？"},
    {"id": "e", "text": "取得相機", "kind": "success"},
    {"id": "f", "text": "整個拒絕", "kind": "failure"},
    {"id": "g", "text": "先向使用者\n要求授權"}
  ],
  "edges": [
    {"from": "a", "to": "b"},
    {"from": "b", "to": "f", "label": "否", "kind": "fail"},
    {"from": "b", "to": "c", "label": "是"},
    {"from": "c", "to": "f", "label": "否", "kind": "fail"},
    {"from": "c", "to": "d", "label": "是"},
    {"from": "d", "to": "e", "label": "是"},
    {"from": "d", "to": "g", "label": "否"},
    {"from": "g", "to": "e", "label": "允許"},
    {"from": "g", "to": "f", "label": "拒絕", "kind": "fail"}
  ]
}
```

![網頁取得相機的兩道關卡](permissions.相機關卡.svg)

1. 殼先看頁面來源：只有本機網頁包伺服器與開發伺服器的頁面算自己供應的，其他內容（例如用內建瀏覽器開的外部網址）拿不到相機。
2. 再看要求的資源：必須全部在放行清單內，只要有一個不在就整個拒絕，不挑著給。
3. 兩關都過，只代表殼不擋；作業系統沒有授權時，仍要先向使用者要求，被拒絕就取不到。

來源：1. [media_permission.dart](../../../shell/lib/src/bridge/media_permission.dart)　2. [aqutter_config.dart](../../../shell/lib/src/aqutter_config.dart)

### plugin 如何要權限

plugin 在啟動時拿到的 context 提供三個動作：查詢現況（不跳授權視窗）、要求授權（必要時跳系統視窗）、開啟本 App 的系統設定頁。網頁的權限 handler 走同一個權限服務，兩邊行為一致。被永久拒絕後只能由使用者在系統設定改，所以要引導到設定頁。

來源：1. [permission_service.dart](../../../shell/lib/src/bridge/permission_service.dart)　2. [aqutter_plugin.dart](../../../shell/lib/src/plugin/aqutter_plugin.dart)

## 規則

| 規則 | 說明 |
|---|---|
| 唯一出入口 | 網頁 handler 與 plugin 都經殼的權限服務；plugin 不需要、也不應自行相依權限套件 |
| 型別與狀態 | 型別字串與狀態字串沿用網頁端的權限型別與狀態；不認識的型別一律回拒絕，不丟例外 |
| 放行清單 | 設定項目控制網頁可取得的 WebView 資源，預設相機、麥克風與兩者 |
| 來源限制 | 只放行殼自己供應的頁面，不隨設定改變 |
| plugin 不能自己回答 | 不開放 plugin 對 WebView 授權各自決定，避免把決定權分散 |
| 可注入 | 權限服務可被替換，測試不碰平台 |

來源：1. [permission_service.dart](../../../shell/lib/src/bridge/permission_service.dart)　2. [plugins.md](../../../docs/plugins.md)

## 錯誤與提示

| 文案 | 條件 | 處置 |
|---|---|---|
| 相機沒有畫面 | 頁面不是殼自己供應的，或要求了放行清單外的資源 | 確認頁面來源與放行清單設定 |
| 授權被永久拒絕 | 使用者在系統層選了不再詢問 | 引導使用者開啟系統設定頁 |

來源：1. [media_permission.dart](../../../shell/lib/src/bridge/media_permission.dart)

---
[⚙️ Env](../environment.md) | [🏠 Wiki](../index.md)
