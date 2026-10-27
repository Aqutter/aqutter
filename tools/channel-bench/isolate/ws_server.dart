// 獨立的 WebSocket 基準伺服器（不依賴 Flutter）：把「慢」隔離到底在哪一層。
//
//   dart run tools/channel-bench/isolate/ws_server.dart [埠，預設 8765]
//
// 與 App 內 bench_plugin.dart 的伺服器協定相同：
//   文字 {"mode":"down","count":N,"bytes":B}  → 伺服器連續送 N 則 B 位元組的二進位訊息，最後送文字 "done"
//   二進位訊息                                 → 計入上行
//   文字 {"mode":"upEnd"}                      → 回 {"count":…,"bytes":…}
// 另外在 `/` 提供 ws_page.html，讓一般瀏覽器可以用同一份 JS 測試。
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

Future<void> main(List<String> args) async {
  final port = args.isEmpty ? 8765 : int.parse(args.first);
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  final page = File('${File.fromUri(Platform.script).parent.path}/ws_page.html');
  stdout.writeln('ws bench server on http://127.0.0.1:${server.port}/  (ws://127.0.0.1:${server.port}/)');
  await for (final request in server) {
    if (!WebSocketTransformer.isUpgradeRequest(request)) {
      request.response.headers.contentType = ContentType.html;
      request.response.write(await page.readAsString());
      await request.response.close();
      continue;
    }
    final socket = await WebSocketTransformer.upgrade(request, compression: CompressionOptions.compressionOff);
    var uploadBytes = 0;
    var uploadCount = 0;
    socket.listen((message) {
      if (message is String) {
        final command = jsonDecode(message) as Map<String, dynamic>;
        if (command['mode'] == 'down') {
          final count = command['count'] as int;
          final chunk = Uint8List(command['bytes'] as int);
          for (var i = 0; i < count; i++) {
            socket.add(chunk);
          }
          socket.add('done');
        }
        else if (command['mode'] == 'upEnd') {
          socket.add(jsonEncode({'count': uploadCount, 'bytes': uploadBytes}));
          uploadBytes = 0;
          uploadCount = 0;
        }
      }
      else if (message is List<int>) {
        uploadBytes += message.length;
        uploadCount += 1;
      }
    });
  }
}
