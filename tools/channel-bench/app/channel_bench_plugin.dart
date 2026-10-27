import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:aqutter/aqutter.dart';
import 'package:aqutter_core/aqutter_core.dart';

/// 統一傳輸的 Android 實機驗證（暫存複本）。
class BenchPlugin extends AqutterPlugin {
  AqutterPluginContext? _context;

  @override
  String get id => 'bench';

  @override
  void attach(AqutterPluginContext context) {
    _context = context;
  }

  @override
  Map<String, AqutterPluginHandler> get handlers => {
        'ping': (payload) async => {'ok': true},
        // 原樣回傳（含二進位）
        'echo': (payload) async => payload,
        // 產生 bytes 位元組的二進位
        'source': (payload) async => {'data': Uint8List(payload['bytes'] as int)},
        // 回傳收到的位元組數（量上行）
        'sink': (payload) async => {'length': (payload['data'] as Uint8List).length},
        // 連發 count 個事件，每個帶 bytes 位元組的二進位
        'startEvents': (payload) async {
          final count = payload['count'] as int;
          final chunk = Uint8List(payload['bytes'] as int);
          for (var i = 0; i < count; i++) {
            await _context!.emit('event', {'i': i, 'data': chunk});
          }
          return {'sent': count};
        },
        'slow': (payload) async {
          await Future<void>.delayed(const Duration(seconds: 2));
          return {'ok': true};
        },
        'boom': (payload) async => throw StateError('boom'),
        'coded': (payload) async => aqutterErrorPayload('DENIED', 'not allowed'),
        // 讓殼重啟本機伺服器：連線會以 1001 關閉，網頁端應自動重連
        'restartHost': (payload) async {
          Future<void>.delayed(const Duration(milliseconds: 50), () => AqutterNativeHost.instance.restart());
          return {'ok': true};
        },
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
