# aqutter（shell）

Aqutter 的 Flutter 殼：在 WebView 內承載網頁，提供內嵌本機 server、OTA 網頁包更新、原生 bridge handlers 與 plugin 介面。以 git 依賴使用，不發佈 pub.dev。

```dart
import 'package:aqutter/aqutter.dart';

Future<void> main() => runAqutter(
      config: const AqutterConfig(title: 'My App'),
      plugins: const [],
    );
```

通常不手寫：`aqutter init` 會產生完整的 App 專案。環境變數見 [docs/environment.md](../docs/environment.md)，plugin 見 [docs/plugins.md](../docs/plugins.md)。

```bash
flutter analyze && flutter test
```
