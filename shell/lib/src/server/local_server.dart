import 'dart:io';

import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_static/shelf_static.dart';

/// 網頁字型的掛載前綴（不含前導斜線，與 shelf 的 `Request.url.path` 同形）。
///
/// 刻意不與網頁包共用命名空間：`/assets/` 已被網頁包佔用（`assets/sql-wasm.wasm`），
/// 共用會讓網頁包未來新增的同路徑檔案被字型 handler 靜默遮蔽，且只在 production
/// 發生——dev 由 web dev server 供應，根本不經過本 Cascade。
///
/// 三處必須一致：本常數、`app/assets/css/tailwind.css` 的 `@font-face`、
/// 以及 dev 用的 `vite/devFlutterAssetsPlugin.ts`。
const String kFontsUrlPrefix = '_flutter/fonts';

/// 內嵌本機 HTTP server：服務可寫目錄中的 web build 與殼提供的字型。
///
/// 僅綁 loopback（127.0.0.1）與隨機埠，提供正常 origin，讓 WebView 內的
/// OPFS / Worker / service worker / 相對路徑皆正常運作，且支援熱更新
/// （更新可寫目錄內容後 reload 即生效）。
class LocalWebServer {
  HttpServer? _server;

  /// 以 [documentRoot] 為網頁根、[fontsRoot] 為字型根啟動 server，回傳可載入的 base URI。
  ///
  /// [fontsRoot] 刻意設為必填具名參數：server 在啟動與執行期更新後各啟動一次，
  /// 選填會讓其中一處漏傳而在 OTA 之後靜默失去字型，必填則由編譯器擋下。
  Future<Uri> start(String documentRoot, {required String fontsRoot}) async {
    await stop();
    final handler = Cascade()
        .add(_fontsHandler(fontsRoot))
        .add(createStaticHandler(
          documentRoot,
          defaultDocument: 'index.html',
          // SPA：找不到實體檔時交由 index.html 處理路由
          listDirectories: false,
        ))
        .handler;
    final server = await shelf_io.serve(handler, InternetAddress.loopbackIPv4, 0);
    _server = server;
    return Uri(scheme: 'http', host: '127.0.0.1', port: server.port);
  }

  /// 字型 handler：只認 [kFontsUrlPrefix] 之下的路徑，其餘一律回 404
  /// 讓 [Cascade] 落到網頁包的 handler。
  Handler _fontsHandler(String fontsRoot) {
    final serveFonts = createStaticHandler(fontsRoot);
    return (Request request) {
      if (!request.url.path.startsWith('$kFontsUrlPrefix/')) {
        return Response.notFound(null);
      }
      // 把前綴移進 handlerPath，讓 shelf_static 以 fontsRoot 為根解析剩餘路徑
      return serveFonts(request.change(path: kFontsUrlPrefix));
    };
  }

  /// 停止 server（若正在運行）。
  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
  }
}
