import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

/// 單一 TCP 連線包裝：持有 socket 並累積接收到的位元組供 read 取用。
class _TcpClient {
  _TcpClient(this.socket) {
    _subscription = socket.listen(
      _buffer.addAll,
      onError: (_) {},
      cancelOnError: false,
    );
  }

  final Socket socket;
  final List<int> _buffer = [];
  late final StreamSubscription<Uint8List> _subscription;

  void send(List<int> data) {
    socket.add(data);
  }

  /// 讀取 [expectLen] 個位元組，最多等待 [timeoutMs]；逾時回傳目前已收到的內容。
  Future<List<int>> read(int expectLen, int timeoutMs) async {
    final deadline = DateTime.now().add(Duration(milliseconds: timeoutMs));
    while (_buffer.length < expectLen && DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    final take = _buffer.length < expectLen ? _buffer.length : expectLen;
    final out = _buffer.sublist(0, take);
    _buffer.removeRange(0, take);
    return out;
  }

  Future<void> close() async {
    await _subscription.cancel();
    socket.destroy();
  }
}

/// TCP 連線管理：對接前端 useTcpPrinter / usePrinterLocalNetwork。
class TcpService {
  final Map<int, _TcpClient> _clients = {};
  int _nextId = 1;

  static const Duration _connectTimeout = Duration(seconds: 5);

  /// 建立連線，回傳 client id。
  Future<int> connect(String host, int port) async {
    final socket = await Socket.connect(host, port, timeout: _connectTimeout);
    final id = _nextId++;
    _clients[id] = _TcpClient(socket);
    return id;
  }

  _TcpClient _require(int id) {
    final client = _clients[id];
    if (client == null) {
      throw StateError('TCP client $id not found');
    }
    return client;
  }

  void send(int id, List<int> data) {
    _require(id).send(data);
  }

  Future<List<int>> read(int id, int expectLen, int timeoutMs) {
    return _require(id).read(expectLen, timeoutMs);
  }

  Future<void> disconnect(int id) async {
    final client = _clients.remove(id);
    await client?.close();
  }

  /// 連線診斷（iOS Local Network 權限觸發用）。回傳診斷狀態字串。
  Future<String> diagnose(String host, int port) async {
    try {
      final socket = await Socket.connect(host, port, timeout: _connectTimeout);
      socket.destroy();
      return 'notDenied';
    }
    on SocketException {
      // 連線失敗無法區分權限拒絕與一般網路問題，統一回 unavailable
      return 'unavailable';
    }
  }
}
