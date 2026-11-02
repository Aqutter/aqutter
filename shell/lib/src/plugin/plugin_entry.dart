import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'aqutter_plugin.dart';

/// 建立 plugin 的工廠：可以同步或非同步，並從 [context] 取得啟動期間可安全使用的資源。
///
/// 編譯期的環境值（`--dart-define-from-file` 帶進來的 env）不經由 context，
/// 工廠內直接用 `const String.fromEnvironment('KEY')`。
typedef AqutterPluginFactory = FutureOr<AqutterPlugin> Function(AqutterBootContext context);

/// 以工廠建立的 plugin。[name] 是 plugin id，只用來在建立失敗時指出是哪一個。
class AqutterPluginBuilder implements AqutterPluginEntry {
  const AqutterPluginBuilder(this.name, this.build);

  final String name;
  final AqutterPluginFactory build;
}

/// 啟動期間可安全取得的資源，交給 [AqutterPluginFactory]。
///
/// 這不是 widget 樹的 `BuildContext`：建立 plugin 時畫面還不存在。plugin 要用樹內的資源
/// （主題、`MediaQuery` 等），請在 `buildUnderlay`、`buildOverlay` 取得 `BuildContext`，
/// 或在 `attach` 取得 `AqutterPluginContext`。
class AqutterBootContext {
  AqutterBootContext({
    Future<SharedPreferences>? preferences,
    Future<Directory>? supportDirectory,
    TargetPlatform? platform,
  })  : _injectedPreferences = preferences,
        _injectedSupportDirectory = supportDirectory,
        platform = platform ?? defaultTargetPlatform;

  final Future<SharedPreferences>? _injectedPreferences;
  final Future<Directory>? _injectedSupportDirectory;

  /// 目前平台。
  final TargetPlatform platform;

  /// App 的偏好設定（與殼自己用的是同一份）。
  Future<SharedPreferences> get preferences => _injectedPreferences ?? SharedPreferences.getInstance();

  /// App 的支援目錄。
  Future<Directory> get supportDirectory => _injectedSupportDirectory ?? getApplicationSupportDirectory();
}

/// 工廠建立失敗（丟例外或逾時）；[name] 是 plugin id。
class AqutterPluginInitException implements Exception {
  const AqutterPluginInitException(this.name, this.cause);

  final String name;
  final Object cause;

  @override
  String toString() => "plugin '$name' 初始化失敗：$cause";
}

/// 每個工廠最長可以花的時間。
const Duration aqutterPluginBuildTimeout = Duration(seconds: 30);

/// 把清單解析成 [AqutterPlugin]：依清單順序逐一處理，現成的實例直接採用，工廠以 `await` 取得。
///
/// 任何一個工廠丟例外或逾時，整個解析就失敗（[AqutterPluginInitException]），
/// 不會略過那個 plugin 繼續：靜默少一個 plugin 會讓人以為功能壞了。
Future<List<AqutterPlugin>> resolvePluginEntries(
  List<AqutterPluginEntry> entries,
  AqutterBootContext context, {
  Duration timeout = aqutterPluginBuildTimeout,
}) async {
  final resolved = <AqutterPlugin>[];
  for (final entry in entries) {
    if (entry is AqutterPlugin) {
      resolved.add(entry);
    }
    else if (entry is AqutterPluginBuilder) {
      try {
        resolved.add(await Future<AqutterPlugin>.sync(() => entry.build(context)).timeout(timeout));
      }
      on TimeoutException {
        throw AqutterPluginInitException(entry.name, '超過 ${timeout.inSeconds} 秒沒有完成');
      }
      catch (error) {
        throw AqutterPluginInitException(entry.name, error);
      }
    }
    else {
      throw ArgumentError.value(entry, 'plugins', 'Must be an AqutterPlugin or an AqutterPluginBuilder');
    }
  }
  return resolved;
}
