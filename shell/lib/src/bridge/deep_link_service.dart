import 'dart:async';

import 'package:app_links/app_links.dart';

/// 深層連結的平台層；與 [DeepLinkService] 分開，測試才能不碰原生外掛。
abstract class DeepLinkSource {
  /// 啟動 App 的連結；不是由連結啟動則回 null。
  Future<String?> initialLink();

  /// App 執行期間收到的連結。
  Stream<String> get links;
}

/// 包住 `app_links` 的預設實作（Android、iOS、macOS）。
class AppLinksSource implements DeepLinkSource {
  AppLinksSource([AppLinks? appLinks]) : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;

  @override
  Future<String?> initialLink() => _appLinks.getInitialLinkString();

  @override
  Stream<String> get links => _appLinks.stringLinkStream;
}

/// 深層連結服務：記住啟動連結，並把執行中收到的連結轉給網頁。
///
/// 啟動 App 的那一個連結只由 [initial] 取得、不走事件（契約 §2）：事件在網頁尚未連線時會被丟棄，
/// 冷啟必須有可重複讀取的來源。部分平台的連結串流會把啟動連結也送一次，這裡把「第一筆等於啟動連結」的事件濾掉。
/// 殼不過濾連結內容，網頁收到後要自行驗證。
class DeepLinkService {
  DeepLinkService({DeepLinkSource? source}) : _source = source ?? AppLinksSource();

  final DeepLinkSource _source;

  Future<String?>? _initial;
  StreamSubscription<String>? _subscription;

  /// 啟動 App 的連結；同一個程序內重複呼叫回傳相同值。取得失敗視為沒有連結。
  Future<String?> initial() {
    return _initial ??= _source.initialLink().catchError((Object _) => null);
  }

  /// 開始轉送執行中的連結（可重複呼叫，只訂閱一次）。
  Future<void> listen(void Function(String url) onLink) async {
    if (_subscription != null) {
      return;
    }
    final launchLink = await initial();
    var first = true;
    _subscription = _source.links.listen((url) {
      final duplicateOfLaunch = first && url == launchLink;
      first = false;
      if (duplicateOfLaunch) {
        return;
      }
      onLink(url);
    });
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}
