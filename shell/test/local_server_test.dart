// LocalWebServer 的路由測試：字型掛載點與網頁包根共用同一台 server，由 Cascade 分流。
// 此處只驗證分流結果，不觸及 Flutter 資源或平台通道（字型的佈署由 FontBootstrapper 負責）。

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

import 'package:aqutter/src/server/local_server.dart';

void main() {
  late Directory tempDir;
  late Directory webRoot;
  late Directory fontsRoot;
  late LocalWebServer server;
  late Uri baseUrl;

  /// 取得 [path] 的狀態碼與內容；每次都用新的 client，避免連線被重用而影響關閉。
  Future<({int statusCode, String body})> get(String path) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(baseUrl.replace(path: path));
      final response = await request.close();
      final body = await response.transform(const SystemEncoding().decoder).join();
      return (statusCode: response.statusCode, body: body);
    }
    finally {
      client.close(force: true);
    }
  }

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('local_server_test');
    webRoot = await Directory(p.join(tempDir.path, 'web')).create();
    fontsRoot = await Directory(p.join(tempDir.path, 'fonts')).create();

    await File(p.join(webRoot.path, 'index.html')).writeAsString('web-index');
    // 網頁包實際帶有 assets/ 目錄（sql-wasm.wasm）；用它驗證字型掛載點不會遮蔽網頁包
    await Directory(p.join(webRoot.path, 'assets')).create();
    await File(p.join(webRoot.path, 'assets', 'sql-wasm.wasm')).writeAsString('wasm-bytes');
    await File(p.join(fontsRoot.path, 'Sample-VF.woff2')).writeAsString('font-bytes');

    server = LocalWebServer();
    baseUrl = await server.start(webRoot.path, fontsRoot: fontsRoot.path);
  });

  tearDown(() async {
    await server.stop();
    await tempDir.delete(recursive: true);
  });

  test('serves fonts from the fonts root under the mount prefix', () async {
    final response = await get('/$kFontsUrlPrefix/Sample-VF.woff2');

    expect(response.statusCode, 200);
    expect(response.body, 'font-bytes');
  });

  test('falls through to the web bundle for paths outside the prefix', () async {
    final response = await get('/');

    expect(response.statusCode, 200);
    expect(response.body, 'web-index');
  });

  test('does not shadow the web bundle own assets directory', () async {
    // 掛載點刻意不用 /assets/：若共用命名空間，這個請求會被字型 handler 攔走
    final response = await get('/assets/sql-wasm.wasm');

    expect(response.statusCode, 200);
    expect(response.body, 'wasm-bytes');
  });

  test('returns 404 for a missing font rather than the web bundle index', () async {
    final response = await get('/$kFontsUrlPrefix/NoSuchFont.woff2');

    expect(response.statusCode, 404);
    expect(response.body, isNot('web-index'));
  });
}
