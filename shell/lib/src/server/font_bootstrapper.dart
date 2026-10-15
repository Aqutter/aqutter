import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// 打包於 assets 的網頁字型佈署器。
///
/// 字型供 WebView 內的網頁使用，由 [LocalWebServer] 掛在 `kFontsUrlPrefix` 之下。
/// 刻意**不**放進熱更新網頁包：熱更新是整包 zip 全量下載（見 `BundleManager.checkForUpdate`），
/// 字型在包內會讓每次 OTA 重付其完整體積；改隨 App 二進位走則只在升版時付一次。
///
/// 複製到可寫目錄而非直接由 rootBundle 服務：shelf_static 能以檔案串流回應，
/// 由 rootBundle 服務則需把整份字型常駐 heap。行動裝置上磁碟比記憶體便宜。
class FontBootstrapper {
  /// 殼套件內的字型目錄；與殼套件 pubspec.yaml 的 `flutter.assets` 宣告一致。
  static const String _assetDir = 'packages/aqutter/assets/fonts';

  /// 要佈署的字型檔名；同時是複製後的檔名，網頁端的 `@font-face` 依此組出 url。
  static const List<String> _fontFiles = [
    'NotoSansCJKtc-VF.woff2',
    'NotoSans-VF.woff2',
    'Cubic_11.woff2',
  ];

  /// 佈署標記檔名；內容為 [_stampContent]，用於判定既有佈署是否仍為最新。
  static const String _stampFile = '.stamp';

  /// 佈署版本。字型「檔名不變但內容更換」時**必須遞增**，否則既有安裝會沿用舊檔。
  /// 檔名有增減時不需要動這裡——[_stampContent] 已納入檔名清單，會自動觸發重新佈署。
  static const String _deployVersion = '1';

  /// 標記內容：佈署版本 + 檔名清單。
  static String get _stampContent => '$_deployVersion\n${_fontFiles.join('\n')}';

  /// 確保字型已佈署於可寫目錄，回傳其絕對路徑供 server 作為字型服務根。
  Future<String> ensureFonts() async {
    final dir = await _fontsDir();
    await dir.create(recursive: true);

    if (await _isUpToDate(dir)) {
      return dir.path;
    }

    for (final name in _fontFiles) {
      final data = await rootBundle.load('$_assetDir/$name');
      final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      await File(p.join(dir.path, name)).writeAsBytes(bytes, flush: true);
    }

    // 標記刻意最後才寫：中途失敗時標記不存在，下次冷啟會重新佈署整組，
    // 不會留下「標記說已完成、實際只有半套」的狀態
    await File(p.join(dir.path, _stampFile)).writeAsString(_stampContent, flush: true);

    return dir.path;
  }

  Future<Directory> _fontsDir() async {
    final support = await getApplicationSupportDirectory();
    return Directory(p.join(support.path, 'fonts'));
  }

  /// 既有佈署是否與目前 assets 一致。
  Future<bool> _isUpToDate(Directory dir) async {
    final stamp = File(p.join(dir.path, _stampFile));
    if (!await stamp.exists()) {
      return false;
    }
    if (await stamp.readAsString() != _stampContent) {
      return false;
    }

    // 標記正確但檔案本身被清掉（部分 OS 會回收可寫目錄）時仍需重新佈署
    for (final name in _fontFiles) {
      if (!await File(p.join(dir.path, name)).exists()) {
        return false;
      }
    }
    return true;
  }
}
