import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:aqutter/aqutter.dart';
import 'package:aqutter_core/aqutter_core.dart';

/// 通用二進位通道的 Android 實機驗證（暫存複本）。
/// 協定（第一個位元組是指令）：0 = 原樣回傳；1 = 下行（count u32, size u32）；2 = 回報累計上行（回 count u32, bytes u32）。
class BenchPlugin extends AqutterPlugin {
  @override
  String get id => 'bench';

  @override
  void attach(AqutterPluginContext context) {
    AqutterNativeHost.instance.registerChannel('bench.bin', (connection) {
      var upCount = 0;
      var upBytes = 0;
      connection.messages.listen((data) {
        switch (data[0]) {
          case 0:
            connection.send(data);
          case 1:
            final view = ByteData.sublistView(data);
            final count = view.getUint32(1);
            final chunk = Uint8List(view.getUint32(5));
            for (var i = 0; i < count; i++) {
              connection.send(chunk);
            }
            connection.send(Uint8List.fromList([0xFF]));
          case 2:
            final reply = ByteData(8)..setUint32(0, upCount)..setUint32(4, upBytes);
            connection.send(reply.buffer.asUint8List());
            upCount = 0;
            upBytes = 0;
          default:
            upCount += 1;
            upBytes += data.length;
        }
      });
    });
  }

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'report': (payload) async {
          final text = const JsonEncoder.withIndent('  ').convert(jsonDecode(payload['json'] as String));
          for (final line in text.split('\n')) {
            // ignore: avoid_print
            print('CHBENCH $line');
          }
          // ignore: avoid_print
          print('CHBENCH_END');
          return {'path': Directory.systemTemp.path};
        },
      };
}
