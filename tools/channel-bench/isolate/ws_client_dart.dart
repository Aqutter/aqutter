// Dart 的 WebSocket 客戶端，連獨立伺服器 ws_server.dart：純 dart:io 對 dart:io 的上限。
//   dart run tools/channel-bench/isolate/ws_client_dart.dart [埠，預設 8765]
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

const mb = 1024 * 1024;

double round3(double value) => (value * 1000).roundToDouble() / 1000;

Future<Map<String, Object?>> down(int port, int count, int bytes) async {
  final socket = await WebSocket.connect('ws://127.0.0.1:$port/', compression: CompressionOptions.compressionOff);
  var received = 0;
  var receivedBytes = 0;
  final finished = Completer<void>();
  socket.listen((message) {
    if (message is String) {
      finished.complete();
    }
    else if (message is List<int>) {
      received += 1;
      receivedBytes += message.length;
    }
  });
  final watch = Stopwatch()..start();
  socket.add(jsonEncode({'mode': 'down', 'count': count, 'bytes': bytes}));
  await finished.future;
  final ms = watch.elapsedMicroseconds / 1000;
  await socket.close();
  return {'direction': 'down', 'count': received, 'bytesEach': bytes, 'ms': round3(ms), 'mbPerSecond': round3((receivedBytes / mb) / (ms / 1000)), 'messagesPerSecond': (received / (ms / 1000)).round()};
}

Future<Map<String, Object?>> up(int port, int count, int bytes) async {
  final socket = await WebSocket.connect('ws://127.0.0.1:$port/', compression: CompressionOptions.compressionOff);
  final chunk = Uint8List(bytes);
  final reply = Completer<Map<String, dynamic>>();
  socket.listen((message) {
    if (message is String) {
      reply.complete(jsonDecode(message) as Map<String, dynamic>);
    }
  });
  final watch = Stopwatch()..start();
  for (var i = 0; i < count; i++) {
    socket.add(chunk);
  }
  socket.add(jsonEncode({'mode': 'upEnd'}));
  final result = await reply.future;
  final ms = watch.elapsedMicroseconds / 1000;
  await socket.close();
  return {'direction': 'up', 'count': result['count'], 'bytesEach': bytes, 'ms': round3(ms), 'mbPerSecond': round3(((result['bytes'] as int) / mb) / (ms / 1000)), 'messagesPerSecond': ((result['count'] as int) / (ms / 1000)).round()};
}

Future<void> main(List<String> args) async {
  final port = args.isEmpty ? 8765 : int.parse(args.first);
  final results = [
    await down(port, 200, mb),
    await up(port, 200, mb),
    await down(port, 20000, 64),
    await up(port, 20000, 64),
  ];
  stdout.writeln(const JsonEncoder.withIndent('  ').convert({'client': 'dart ${Platform.version.split(' ').first}', 'results': results}));
  exit(0);
}
