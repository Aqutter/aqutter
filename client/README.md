# @aqutter/aqutter

Aqutter 殼的網頁端 client：框架中立（不依賴 Nuxt / Vite 等），提供

- `isFlutter()`、`callFlutter(handler, payload)`、`onFlutterEvent(channel, listener)`：呼叫殼內建 handler、訂閱事件
- `isBridgeSupported(handler)`：本平台是否真的做得到
- Plugin API：`callPlugin`、`onPluginEvent`、`isPluginSupported`（型別由各 plugin 併入 `AqutterPluginRegistry`）
- `@aqutter/aqutter/contract`：handler / 事件名稱與 payload 型別（與 `shell` 的 `bridge_names.dart` 成對）

以 TypeScript 原始碼發佈，由使用端打包器編譯。安裝：

```bash
pnpm add "github:Aqutter/aqutter#0.1.0&path:/client"
```

使用與 plugin 開發見 [docs/](../docs)。
