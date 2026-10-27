import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:aqutter/aqutter.dart';

/// 通道效能基準用的 plugin（只在暫存複本裡，不進任何 repo）。
///
/// 量三層之間（網頁 <-> Flutter）各條通道的延遲與吞吐：
///   echo      小／大 JSON 往返（callHandler）
///   events    Dart -> 網頁的事件（evaluateJavascript）
///   ws        本機 WebSocket 的二進位傳輸（下行、上行）
///   report    把結果寫成檔案，供外部讀取
class BenchPlugin extends AqutterPlugin {
  AqutterPluginContext? _context;
  HttpServer? _server;

  @override
  String get id => 'bench';

  @override
  void attach(AqutterPluginContext context) {
    _context = context;
  }

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        // 原樣回傳：量 callHandler 的往返與序列化成本
        'echo': (payload) async => payload,
        // 只回一個小物件：量「呼叫本身」的成本，不含酬載
        'ping': (payload) async => {'ok': true},
        // Dart -> 網頁事件。mode: 'seq'（每個事件等 evaluateJavascript 完成）或 'burst'（不等）
        'startEvents': (payload) async {
          final count = payload['count'] as int;
          final bytes = payload['bytes'] as int;
          final mode = payload['mode'] as String;
          final pad = 'x' * bytes;
          final context = _context!;
          final watch = Stopwatch()..start();
          if (mode == 'seq') {
            for (var i = 0; i < count; i++) {
              await context.emit('event', {'i': i, 'pad': pad});
            }
          }
          else {
            final pending = <Future<void>>[];
            for (var i = 0; i < count; i++) {
              pending.add(context.emit('event', {'i': i, 'pad': pad}));
            }
            await Future.wait(pending);
          }
          return {'dartMs': watch.elapsedMilliseconds};
        },
        // 開本機 WebSocket 伺服器（關閉壓縮）：回傳埠號
        'startWs': (payload) async {
          _server ??= await _bind();
          return {'port': _server!.port};
        },
        // 把結果寫成檔案
        'report': (payload) async {
          final file = File('${Directory.systemTemp.path}${Platform.pathSeparator}aqutter_chbench.json');
          final decoded = jsonDecode(payload['json'] as String) as Map<String, dynamic>;
          decoded['quality'] = Platform.environment['MIRROR_QUALITY'] ?? 'default(auto)';
          final text = const JsonEncoder.withIndent('  ').convert(decoded);
          payload = {'json': text};
          await file.writeAsString(text);
          // release 版在 Android 讀不到檔案：同時逐行印到 logcat（Flutter 的 print 在 release 也會輸出）
          for (final line in (payload['json'] as String).split('\n')) {
            // ignore: avoid_print
            print('CHBENCH $line');
          }
          // ignore: avoid_print
          print('CHBENCH_END');
          return {'path': file.path};
        },
      };

  Future<HttpServer> _bind() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) async {
      final socket = await WebSocketTransformer.upgrade(request, compression: CompressionOptions.compressionOff);
      var uploadBytes = 0;
      var uploadCount = 0;
      socket.listen((message) async {
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
    });
    return server;
  }
}
