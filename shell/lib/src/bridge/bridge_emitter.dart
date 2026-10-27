import 'package:aqutter_core/aqutter_core.dart';

/// 原生→JS 事件發射器：經 [AqutterRpcHost] 以 `evt` 訊框送給目前的網頁連線。
///
/// 沒有連線時（網頁尚未載入或正在重連）事件直接丟棄，不排隊——想知道狀態的網頁在連線建立後自行查詢。
class BridgeEmitter {
  BridgeEmitter({AqutterRpcHost? rpc}) : _rpc = rpc ?? AqutterRpcHost.instance;

  final AqutterRpcHost _rpc;

  /// 派送事件到指定頻道。
  Future<void> emit(String channel, Object? payload) => _rpc.emit(channel, payload);
}
