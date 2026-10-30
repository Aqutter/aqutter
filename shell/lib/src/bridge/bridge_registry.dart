import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/services.dart';
import 'package:aqutter_core/aqutter_core.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../server/bundle_manager.dart';
import '../server/host_updater.dart';
import '../server/host_version.dart';
import 'permission_service.dart';
import '../server/update_config.dart';
import '../plugin/aqutter_plugin.dart';
import '../server/update_session.dart';
import 'bridge_emitter.dart';
import 'bridge_names.dart';
import 'deep_link_service.dart';
import '../error/aqutter_error_reporter.dart';
import '../error/error_center.dart';
import 'log_retention.dart';
import 'log_service.dart';
import 'native_features.dart';
import 'notification_service.dart';
import 'safe_file_name.dart';
import 'system_ui.dart';
import 'tcp_service.dart';

/// 統一在 AqutterWebViewController 上註冊所有 bridge handler，並串接各服務。
class BridgeRegistry {
  BridgeRegistry({
    required this.emitter,
    required this.preferences,
    required this.bundle,
    required this.session,
    required this.onWebReady,
    this.plugins = const [],
    this.errorCenter,
    this.logRetention = const LogRetention(),
    this.permissions = const AqutterPermissions(),
    NotificationService? notifications,
    DeepLinkService? deepLinks,
    Dio? dio,
  }) : _notificationsOverride = notifications,
       _deepLinksOverride = deepLinks,
       _dio = dio ?? Dio(BaseOptions(
         connectTimeout: _connectTimeout,
         receiveTimeout: _receiveTimeout,
         sendTimeout: _sendTimeout,
       ));

  final BridgeEmitter emitter;
  final SharedPreferences preferences;

  /// 供網頁端查詢網頁包版本；更新流程走 [session]。
  final BundleManager bundle;

  /// 更新流程的狀態機。指令 handler 只回報**是否受理**，之後的每個狀態由它以
  /// `update_state` 事件推回網頁；做不到的情境（dev 模式、已有流程在跑）**必須**
  /// 回報未受理，網頁端才能解鎖按鈕。
  final UpdateSession session;

  /// 網頁層回報已就緒（`app_ready`）。host 據此移除啟動過場。
  ///
  /// 會隨 WebView 每次重掛而再次觸發（套用網頁包更新後），故實作端必須可重入。
  final void Function() onWebReady;

  /// App 傳入的 plugin。handler 於 [register] 掛上，事件入口於首次 [register] 交付。
  final List<AqutterPlugin> plugins;

  /// 錯誤集散點；為 null 時 `crash_ack`／`error_report` 只回應 ok、不做事。
  final ErrorCenter? errorCenter;

  /// 預設日誌目錄的保留策略。
  final LogRetention logRetention;

  /// 系統層權限的出入口；網頁 handler 與 plugin 的 context 共用同一份。
  final AqutterPermissions permissions;

  final Dio _dio;

  final NotificationService? _notificationsOverride;
  final DeepLinkService? _deepLinksOverride;

  /// 本機通知與深層連結服務：只在支援的平台、被用到時才建立，其他平台不碰原生外掛。
  late final NotificationService _notifications = _notificationsOverride ?? NotificationService(permissions: permissions);
  late final DeepLinkService _deepLinks = _deepLinksOverride ?? DeepLinkService();

  /// 網頁與 Dart 之間的多工 RPC（`aqutter_core`）。
  final AqutterRpcHost _rpc = AqutterRpcHost.instance;

  /// 連線逾時。dio 預設不設限（`null` 等同無上限），會讓斷線的請求一路吊到
  /// OS 的 socket 預設（Android 約 130 秒）。此處為保底防線；per-request 的
  /// 控制由前端 AbortSignal 經 [BridgeHandler.httpAbort] 負責。
  static const Duration _connectTimeout = Duration(seconds: 15);
  static const Duration _receiveTimeout = Duration(seconds: 30);
  static const Duration _sendTimeout = Duration(seconds: 30);

  late final LogService _log = LogService(retention: logRetention);
  final TcpService _tcp = TcpService();
  final Battery _battery = Battery();
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  /// 進行中的原生 HTTP 請求；鍵為前端產生的 requestId，供 abort 時取回對應的取消權杖。
  final Map<String, CancelToken> _httpCancelTokens = {};

  /// 本平台**實際可用**的 handler 名稱，由 [_handle] 於註冊時收集，
  /// 經 `platform_info` 的 `capabilities` 回報給網頁層。
  ///
  /// 刻意不等同於「有沒有註冊」：多數 handler 在所有平台都會註冊，但實作可能在
  /// 部分平台是 no-op（例如 `minimize_app` 需 Android 的 `moveTaskToBack`，
  /// 其他平台吞掉 MissingPluginException 後仍回 `{'ok': true}`，網頁層無從分辨）。
  /// 故可用與否由各 handler 在 [_handle] 的 `supported:` 自行宣告，
  /// 與實作寫在同一處，不會分裂成第二份表。
  final Set<String> _capabilities = {};

  /// 行動平台；方向鎖定與系統列控制皆僅在此類平台有意義。
  bool get _isMobile => Platform.isAndroid || Platform.isIOS;

  /// 系統事件是否已訂閱。register 會隨 WebView 重掛而重跑（更新網頁包後），
  /// 但 battery / connectivity 的訂閱只該有一份，否則每次重掛都會多疊一組 listener。
  bool _broadcastStarted = false;

  /// 宿主事件 handler 是否已掛上；理由同 [_broadcastStarted]，避免 WebView 重掛時重複註冊。
  bool _hostEventsRegistered = false;

  AqutterChromeSafariBrowser? _iab;

  /// 取得平台呼叫傳入的 payload（單一物件，位於 args[0]）。
  Map<String, dynamic> _payload(List<dynamic> args) {
    if (args.isEmpty || args.first is! Map) {
      return const {};
    }
    return Map<String, dynamic>.from(args.first as Map);
  }

  /// 註冊全部 handler。應於 onWebViewCreated 後呼叫。
  ///
  /// handler 都登錄在 [AqutterRpcHost]，與 WebView 無關；WebView 重掛（套用網頁包更新後）重跑時同名取代。
  /// 系統事件訂閱則只會在首次呼叫時建立。網頁取得連線資訊的方式不在這裡：殼把端點注入頁面（見 `endpoint_script.dart`）。
  void register() {
    _registerPlatform();
    _registerStore();
    _registerDownload();
    _registerLog();
    _registerHttp();
    _registerBundle();
    _registerDevice();
    _registerPermissions();
    _registerOpenerAndBrowser();
    _registerNativeFeatures();
    _registerPicker();
    _registerTcp();
    _registerUi();
    _registerPlugins();
    _startBroadcast();
    _registerHostEvents();
  }

  /// plugin 是否已 attach；理由同 [_broadcastStarted]——WebView 重掛時 handler 要重掛、context 不該重發。
  bool _pluginsAttached = false;

  /// 掛上各 plugin 的 handler（名稱 `<id>.<method>`，列入 capabilities），並於首次呼叫時 attach。
  ///
  /// plugin 宣告了 `supportedPlatforms` 且不含目前平台時：handler 仍註冊但不列入 capabilities，被呼叫時
  /// 回傳 `aqutterError`（`UNSUPPORTED_PLATFORM`）而不執行 plugin 的函式，也不呼叫 `attach`。
  ///
  /// id 不合法或兩個 plugin 同 id 會直接拋錯：這是 App 組裝期的程式錯誤，不該拖到網頁呼叫時才發現。
  void _registerPlugins() {
    final seen = <String>{};
    for (final plugin in plugins) {
      if (!aqutterPluginIdPattern.hasMatch(plugin.id)) {
        throw ArgumentError.value(plugin.id, 'AqutterPlugin.id', 'Must match ${aqutterPluginIdPattern.pattern}');
      }
      if (plugin.id == aqutterReservedPluginId) {
        throw ArgumentError.value(plugin.id, 'AqutterPlugin.id', 'Reserved for the host');
      }
      if (!seen.add(plugin.id)) {
        throw ArgumentError.value(plugin.id, 'AqutterPlugin.id', 'Duplicate plugin id');
      }
      final supported = aqutterPluginSupports(plugin, defaultTargetPlatform);
      for (final entry in plugin.handlers.entries) {
        final name = aqutterPluginHandlerName(plugin.id, entry.key);
        if (supported) {
          _handle(name, entry.value);
        }
        else {
          _handle(
            name,
            supported: false,
            (_) async => throw AqutterRpcException(
              aqutterUnsupportedPlatform,
              '$name is not supported on ${_currentPlatform()}',
            ),
          );
        }
      }
    }
    if (_pluginsAttached) {
      return;
    }
    _pluginsAttached = true;
    for (final plugin in plugins) {
      if (aqutterPluginSupports(plugin, defaultTargetPlatform)) {
        plugin.attach(_PluginContext(plugin.id, emitter, permissions));
      }
    }
  }

  /// 釋放 plugin 資源。
  void disposePlugins() {
    for (final plugin in plugins) {
      plugin.dispose();
    }
  }

  /// 原生宿主事件（Kotlin→Dart→JS）。
  ///
  /// MainActivity 於 `dispatchKeyEvent` 攔到功能鍵時，經同一條 `app/host` channel 反向
  /// invoke；此處僅原樣轉為 JS 事件，鍵值的正規化（吸收裝置怪癖）已在原生層完成。
  ///
  /// 與 `_startBroadcast` 同樣只需建立一次：handler 掛在 channel 而非 WebView controller，
  /// WebView 重掛（套用網頁包更新）不會重複註冊。
  void _registerHostEvents() {
    if (_hostEventsRegistered) {
      return;
    }
    _hostEventsRegistered = true;

    _hostChannel.setMethodCallHandler((call) async {
      switch (call.method) {
        case HostMethod.hardwareKey:
          await emitter.emit(BridgeEvent.hardwareKey, _payload([call.arguments]));
          return null;
        default:
          throw MissingPluginException('未處理的宿主事件: ${call.method}');
      }
    });
  }

  // ---- Broadcast（原生→JS 事件：電量 / 網路）----
  // 註：自訂 action 廣播（Android BroadcastReceiver）需額外 platform channel，本期未實作。
  void _startBroadcast() {
    if (_broadcastStarted) {
      return;
    }
    _broadcastStarted = true;

    // 兩個 listener 都必須自行吞掉例外：stream listener 內逸出的例外會成為
    // unhandled async error——對使用者是完全無聲的失敗（畫面停在舊值或空值），
    // 且會連帶讓後續事件失去意義。實測 battery 在無電池裝置必定拋 UNAVAILABLE。
    _battery.onBatteryStateChanged.listen((state) async {
      try {
        await emitter.emit(BridgeEvent.battery, await _batteryInfo());
      } catch (e) {
        await _log.append('warn', 'battery 廣播失敗: $e');
      }
    });

    Connectivity().onConnectivityChanged.listen((results) async {
      try {
        await emitter.emit(BridgeEvent.network, _networkStatus(results));
      } catch (e) {
        await _log.append('warn', 'network 廣播失敗: $e');
      }
    });
  }

  Map<String, dynamic> _networkStatus(List<ConnectivityResult> results) {
    final online = results.isNotEmpty && !results.contains(ConnectivityResult.none);
    return {'online': online, 'type': _networkType(results)};
  }

  String _networkType(List<ConnectivityResult> results) {
    if (results.contains(ConnectivityResult.wifi)) return 'wifi';
    if (results.contains(ConnectivityResult.mobile)) return 'cellular';
    if (results.contains(ConnectivityResult.ethernet)) return 'ethernet';
    if (results.isEmpty || results.contains(ConnectivityResult.none)) return 'none';
    return 'other';
  }

  /// 註冊單一 handler 到 [AqutterRpcHost]（網頁經多工連線呼叫）。handler 回傳 [aqutterErrorPayload]
  /// 的結果會被轉成錯誤訊框。
  ///
  /// [supported] 宣告「本 handler 在當前平台是否真的做得到事」，預設 true。
  /// 為 false 時仍會註冊（呼叫下去不會拋 handler not found，行為與過去一致），
  /// 但不列入 [_capabilities]，網頁層即可在呼叫前查得並略過。
  void _handle(
    String name,
    Future<dynamic> Function(Map<String, dynamic> payload) fn, {
    bool supported = true,
  }) {
    if (supported) {
      _capabilities.add(name);
    }
    _rpc.registerHandler(name, (payload) async {
      final result = await fn(payload);
      final error = aqutterErrorOf(result);
      if (error != null) {
        throw error;
      }
      return result;
    });
  }

  // ---- Platform ----
  void _registerPlatform() {
    _handle(BridgeHandler.platformInfo, (_) async => _platformInfo());
    // 網頁就緒訊號。刻意不採 onLoadStop——後者只代表 document 載完，
    // hydration 與首次繪製都還沒發生，此時移除過場仍會露出空白。
    _handle(BridgeHandler.appReady, (_) async {
      onWebReady();
      return {'ok': true};
    });
  }

  /// `capabilities` 於此處讀取而非 [register] 當下組裝：本 handler 雖最早註冊，
  /// 但實際執行是在網頁發問時，那時 [register] 早已跑完，[_capabilities] 已完整。
  Future<Map<String, dynamic>> _platformInfo() async {
    return {
      'platform': _currentPlatform(),
      'osVersion': Platform.operatingSystemVersion,
      'arch': await _arch(),
      'capabilities': _capabilities.toList()..sort(),
    };
  }

  String _currentPlatform() {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    if (Platform.isWindows) return 'windows';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isLinux) return 'linux';
    return 'web';
  }

  Future<String> _arch() async {
    if (Platform.isAndroid) {
      final info = await _deviceInfo.androidInfo;
      return info.supportedAbis.isNotEmpty ? info.supportedAbis.first : 'unknown';
    }
    if (Platform.isIOS) {
      final info = await _deviceInfo.iosInfo;
      return info.utsname.machine;
    }
    return 'unknown';
  }

  // ---- KV Store (shared_preferences) ----
  void _registerStore() {
    _handle(BridgeHandler.storeGet, (payload) async {
      final key = payload['key'] as String;
      return {'value': preferences.getString(key)};
    });

    _handle(BridgeHandler.storeSet, (payload) async {
      final key = payload['key'] as String;
      final value = payload['value'] as String;
      await preferences.setString(key, value);
      return {'ok': true};
    });
  }

  // ---- Download (dio + progress) ----
  void _registerDownload() {
    _handle(BridgeHandler.download, (payload) async {
      final url = payload['url'] as String;
      final problem = downloadFileNameProblem(payload['fileName']);
      if (problem != null) {
        return aqutterErrorPayload('invalid_file_name', problem);
      }
      final fileName = payload['fileName'] as String;
      final requestId = payload['requestId'] as String;
      final toBase64 = (payload['toBase64'] as bool?) ?? false;

      final dir = await getApplicationDocumentsDirectory();
      final targetPath = p.join(dir.path, fileName);

      await _dio.download(
        url,
        targetPath,
        onReceiveProgress: (received, total) {
          if (total <= 0) {
            return;
          }
          emitter.emit(BridgeEvent.downloadProgress, {
            'requestId': requestId,
            'progress': (received / total * 100).clamp(0, 100),
          });
        },
      );

      if (toBase64) {
        final bytes = await File(targetPath).readAsBytes();
        return {
          'uri': 'data:application/octet-stream;base64,${base64Encode(bytes)}',
          'nativeUri': targetPath,
        };
      }
      return {'uri': 'file://$targetPath', 'nativeUri': targetPath};
    });
  }

  // ---- Log ----
  void _registerLog() {
    // 啟動時清理一次舊日誌；之後在每次建立當日新檔時再清理。
    unawaited(_log.prune());
    _handle(BridgeHandler.logAppend, (payload) async {
      final target = payload['target'];
      await _log.append(
        payload['level'] as String,
        payload['message'] as String,
        target: target == null ? null : LogTarget.fromJson(target),
      );
      return {'ok': true};
    });
    _handle(BridgeHandler.logSetKey, (payload) async {
      _log.setKey(payload['key'] as String);
      return {'ok': true};
    });
    _handle(BridgeHandler.logList, (_) async => {'files': await _log.list()});
    _handle(BridgeHandler.logRead, (payload) async {
      return {'content': await _log.read(payload['name'] as String)};
    });
    _handle(BridgeHandler.logWrite, (payload) async {
      await _log.write(payload['name'] as String, payload['bytesBase64'] as String);
      return {'ok': true};
    });
    _handle(BridgeHandler.logRemove, (payload) async {
      await _log.remove(payload['name'] as String);
      return {'ok': true};
    });
    _handle(BridgeHandler.logDir, (_) async => {'dir': await _log.dirPath()});
    _handle(BridgeHandler.crashTake, (_) async {
      final reports = await errorCenter?.take() ?? const <AqutterErrorReport>[];
      return {'reports': [for (final report in reports) report.toJson()]};
    });
    _handle(BridgeHandler.crashAck, (payload) async {
      final ids = payload['ids'];
      await errorCenter?.ack(ids is List ? ids.whereType<String>() : const <String>[]);
      return {'ok': true};
    });
    _handle(BridgeHandler.errorReport, (payload) async {
      errorCenter?.reportFromWeb(
        message: '${payload['message']}',
        stack: payload['stack'] as String?,
        fatal: payload['fatal'] == true,
      );
      return {'ok': true};
    });
  }

  // ---- HTTP fetch（繞 CORS）----
  void _registerHttp() {
    _handle(BridgeHandler.httpFetch, (payload) async {
      final url = payload['url'] as String;
      final method = payload['method'] as String;
      final headers = Map<String, dynamic>.from(payload['headers'] as Map? ?? const {});
      final bodyBase64 = payload['bodyBase64'] as String?;
      final requestId = payload['requestId'] as String?;

      final cancelToken = _trackCancelToken(requestId);
      try {
        final response = await _dio.request<List<int>>(
          url,
          data: bodyBase64 != null ? base64Decode(bodyBase64) : null,
          cancelToken: cancelToken,
          options: Options(
            method: method,
            headers: headers,
            responseType: ResponseType.bytes,
            // 交由前端依 status 判斷，勿在此拋錯
            validateStatus: (_) => true,
          ),
        );

        final responseHeaders = <String, String>{};
        response.headers.forEach((key, values) => responseHeaders[key] = values.join(', '));

        return {
          'status': response.statusCode ?? 0,
          'statusText': response.statusMessage ?? '',
          'headers': responseHeaders,
          'bodyBase64': base64Encode(response.data ?? const []),
        };
      }
      finally {
        _releaseCancelToken(requestId);
      }
    });

    _handle(BridgeHandler.httpAbort, (payload) async {
      final requestId = payload['requestId'] as String;
      // 請求可能已完成並清掉權杖；此時 abort 是無害的空操作
      _httpCancelTokens.remove(requestId)?.cancel('aborted by caller');
      return {'ok': true};
    });
  }

  /// 為可取消的請求建立權杖並登記；[requestId] 缺席（前端未帶）時不登記。
  CancelToken? _trackCancelToken(String? requestId) {
    if (requestId == null) {
      return null;
    }
    final token = CancelToken();
    _httpCancelTokens[requestId] = token;
    return token;
  }

  void _releaseCancelToken(String? requestId) {
    if (requestId == null) {
      return;
    }
    _httpCancelTokens.remove(requestId);
  }

  // ---- 網頁包版本與更新 ----
  void _registerBundle() {
    // 網頁包版本與殼版本一起回：使用者要看的是「這份網頁包配哪個殼」，拆成兩個 handler
    // 只會讓網頁端多一次往返再自行拼裝。
    _handle(BridgeHandler.bundleInfo, (_) async {
      final host = await HostVersion.load();
      return {
        'currentVersion': await bundle.currentVersion(),
        'seedVersion': await bundle.seedVersion(),
        'hostVersion': host.name,
        'hostBuildNumber': host.buildNumberRaw,
      };
    });

    _handle(BridgeHandler.bundleCheckUpdate, (_) => _checkUpdate());

    _handle(BridgeHandler.updateConfigGet, (_) async => _updateConfigInfo());

    _handle(BridgeHandler.updateConfigSet, (payload) => _changeEndpoint(payload));

    _handle(BridgeHandler.updateConfigReset, (_) => _changeEndpoint(null));

    _handle(BridgeHandler.bundleDownloadUpdate, (payload) async {
      return session.requestBundleDownload(apply: _flag(payload, 'apply', defaultValue: true)).toJson();
    });

    // 只取「有沒有受理」這個同步結果，不等更新完成：套用的第一步就是卸下 WebView，
    // 繼續等待會讓本次回應永遠送不回一個已不存在的頁面。
    _handle(BridgeHandler.bundleApplyUpdate, (_) async {
      return (await session.requestBundleApply()).toJson();
    });

    _handle(BridgeHandler.hostDownloadUpdate, (payload) async {
      return session.requestHostDownload(install: _flag(payload, 'install', defaultValue: true)).toJson();
    });

    _handle(BridgeHandler.hostInstallUpdate, (_) async {
      return session.requestHostInstall().toJson();
    });
  }

  /// `update_config_get`：目前生效的端點與編譯期預設。**不回傳 API KEY 的值**，只回有無——
  /// 網頁端不需要讀回密鑰，少一條外洩面。
  Map<String, dynamic> _updateConfigInfo() {
    final store = session.configStore;
    return {
      'overridden': store.override != null,
      ..._endpointInfo(store.current),
      'hasApiKey': store.current.apiKey.isNotEmpty,
      'enabled': store.current.enabled,
      'defaults': _endpointInfo(store.defaults),
    };
  }

  Map<String, dynamic> _endpointInfo(BundleUpdateConfig config) {
    return {
      'baseUrl': config.baseUrl,
      'versionPath': config.versionPath,
      'method': config.method.wireName,
      'apiKeyHeader': config.apiKeyHeader,
    };
  }

  /// `update_config_set`（[payload] 非 null）與 `update_config_reset`（null）。
  ///
  /// 驗證失敗以 `invalid_config` 加上 `error` 說明回報，而不是拋出——網頁端要的是可顯示的原因，
  /// 且既有覆寫不受影響。
  Future<Map<String, dynamic>> _changeEndpoint(Map<String, dynamic>? payload) async {
    final UpdateEndpointOverride? value;
    try {
      value = payload == null ? null : UpdateEndpointOverride.fromJson(payload);
    }
    on ArgumentError catch (e) {
      return {
        'accepted': false,
        'reason': UpdateRejectReason.invalidConfig.wireName,
        'error': '$e',
      };
    }
    final acceptance = await session.changeEndpoint(value);
    return {...acceptance.toJson(), 'error': null};
  }

  /// `bundle_check_update`：查詢結果以資料回報（含殼是否過舊），失敗放在 `error`
  /// 而非拋出——網頁端要的是可顯示的事實，且 dev / 未配置也是一種事實。
  Future<Map<String, dynamic>> _checkUpdate() async {
    if (session.devMode) {
      return _checkResponse(error: UpdateRejectReason.dev.wireName);
    }
    if (!session.config.enabled) {
      return _checkResponse(error: UpdateRejectReason.disabled.wireName);
    }
    try {
      final result = await session.check();
      final requirement = result.remote.host;
      return _checkResponse(
        hasUpdate: result.hasUpdate,
        currentVersion: result.localVersion,
        remoteVersion: result.remote.version,
        size: result.remote.size,
        host: requirement == null
            ? null
            : {
                'blocked': result.hostBlocked,
                'minBuildNumber': requirement.minBuildNumber,
                'updateType': requirement.updateType.wireName,
                'updateUrl': requirement.updateUrl,
                'updateSize': requirement.updateSize,
                'canDownload': HostUpdater.usesApk(requirement) && requirement.updateUrl != null,
              },
      );
    }
    catch (e) {
      return _checkResponse(currentVersion: await bundle.currentVersion(), error: '$e');
    }
  }

  Map<String, dynamic> _checkResponse({
    bool hasUpdate = false,
    String? currentVersion,
    String? remoteVersion,
    int? size,
    Map<String, dynamic>? host,
    String? error,
  }) {
    return {
      'hasUpdate': hasUpdate,
      'currentVersion': currentVersion,
      'remoteVersion': remoteVersion,
      'size': size,
      'host': host,
      'error': error,
    };
  }

  /// 讀取 payload 的布林旗標；缺席或非布林取 [defaultValue]。
  bool _flag(Map<String, dynamic> payload, String key, {required bool defaultValue}) {
    final value = payload[key];
    return value is bool ? value : defaultValue;
  }

  // ---- Device ----
  void _registerDevice() {
    _handle(BridgeHandler.deviceId, (_) async => _deviceIdInfo());
    _handle(BridgeHandler.deviceInfo, (_) async => _deviceInfoMap());
    _handle(BridgeHandler.deviceBattery, (_) async => _batteryInfo());
    _handle(BridgeHandler.deviceNetwork, (_) async => _networkInfo());
    _handle(BridgeHandler.deviceLocale, (_) async => {'tag': Platform.localeName});
  }

  Future<Map<String, dynamic>> _deviceIdInfo() async {
    if (Platform.isAndroid) {
      final info = await _deviceInfo.androidInfo;
      return {'id': info.id, 'source': 'androidId'};
    }
    if (Platform.isIOS) {
      final info = await _deviceInfo.iosInfo;
      return {'id': info.identifierForVendor ?? 'unknown', 'source': 'vendor'};
    }
    return {'id': 'unknown', 'source': 'machineUid'};
  }

  Future<Map<String, dynamic>> _deviceInfoMap() async {
    return {
      'platform': _currentPlatform(),
      'osVersion': Platform.operatingSystemVersion,
      'arch': await _arch(),
      'family': Platform.isWindows ? 'windows' : 'unix',
    };
  }

  /// 電量資訊；**取不到時回 null 欄位而非拋出**。
  ///
  /// 無電池的裝置（iOS 模擬器、多數桌機）在原生層回 `UNAVAILABLE`，那是正常狀態
  /// 而非錯誤——`BatteryInfo` 的兩個欄位在契約上本就是 nullable，畫面亦已預期顯示 `—`。
  /// 讓它拋出只會逼每個呼叫端為「這台機器沒電池」寫錯誤處理，且一旦漏寫就變成
  /// 整個 handler 失敗（Device info 卡片先前正是如此）。
  ///
  /// 刻意不以 `0` 代替：`0` 是合法電量值，會把「沒有電池」偽裝成「快沒電」。
  Future<Map<String, dynamic>> _batteryInfo() async {
    try {
      final level = await _battery.batteryLevel;
      final state = await _battery.batteryState;
      final isCharging = state == BatteryState.charging || state == BatteryState.full;
      return {'level': level / 100.0, 'isCharging': isCharging};
    } catch (e) {
      await _log.append('info', '電量不可得（視為無電池裝置）: $e');
      return {'level': null, 'isCharging': null};
    }
  }

  /// 當前網路狀態；供網頁層在訂閱事件時自行拉取初始值。
  ///
  /// 存在的理由是時序：原生的初始廣播事件發生在 `onWebViewCreated`，早於網頁層
  /// 建立多工連線，那一次推送必然被丟棄（沒有連線時事件不排隊）；而 connectivity 之後只在
  /// 「連線改變」時才會再發，靜置的裝置永遠等不到第二次。改由網頁主動查詢即可
  /// **完全消除時序依賴**——想知道的時候自己問，不必猜原生何時發過什麼。
  Future<Map<String, dynamic>> _networkInfo() async {
    try {
      return _networkStatus(await Connectivity().checkConnectivity());
    } catch (e) {
      await _log.append('warn', '網路狀態查詢失敗: $e');
      return {'online': false, 'type': 'none'};
    }
  }

  // ---- Permissions ----
  void _registerPermissions() {
    // 對應不到的型別一律回 denied，與換套件前落到 Permission.unknown 的行為一致（見 AqutterPermissions）。
    _handle(BridgeHandler.permCheck, (payload) async {
      return {'status': await permissions.check(payload['permission'] as String)};
    });
    _handle(BridgeHandler.permRequest, (payload) async {
      return {'status': await permissions.request(payload['permission'] as String)};
    });
    _handle(BridgeHandler.permOpenSettings, (_) async {
      await permissions.openSettings();
      return {'ok': true};
    });
  }

  // ---- Opener / In-App Browser ----
  void _registerOpenerAndBrowser() {
    _handle(BridgeHandler.openerOpen, (payload) async {
      final uri = Uri.parse(payload['url'] as String);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return {'ok': true};
    });
    _handle(BridgeHandler.iabOpen, (payload) async {
      _iab ??= AqutterChromeSafariBrowser();
      await _iab!.open(url: AqutterWebUri(payload['url'] as String));
      return {'ok': true};
    });
    _handle(BridgeHandler.iabClose, (_) async {
      await _iab?.close();
      return {'ok': true};
    });
  }

  // ---- 剪貼簿、分享、本機通知、深層連結（參數與限制見 native_features.dart） ----

  /// 通知與深層連結只在這些平台有原生實作。
  bool get _hasNotificationsAndLinks => Platform.isAndroid || Platform.isIOS || Platform.isMacOS;

  /// 兩個服務的啟動只做一次：WebView 重掛時 handler 會重掛，但服務與事件訂閱不該重複。
  bool _nativeServicesStarted = false;

  /// 把參數驗證失敗轉成回給網頁的錯誤資料，其餘例外照常往外丟。
  Future<dynamic> _nativeCall(Future<dynamic> Function() body) async {
    try {
      return await body();
    }
    on NativeArgumentException catch (error) {
      return error.toPayload();
    }
  }

  void _registerNativeFeatures() {
    _handle(BridgeHandler.clipboardRead, (_) async {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      return {'text': data?.text};
    });
    _handle(BridgeHandler.clipboardWrite, (payload) {
      return _nativeCall(() async {
        await Clipboard.setData(ClipboardData(text: parseClipboardText(payload)));
        return {'ok': true};
      });
    });
    _handle(BridgeHandler.shareOpen, (payload) {
      return _nativeCall(() async {
        final request = ShareRequest.parse(payload);
        final text = request.combinedText;
        final uri = text == null ? Uri.tryParse(request.url ?? '') : null;
        final result = await SharePlus.instance.share(
          ShareParams(text: text ?? (uri == null ? request.url : null), uri: uri, subject: request.subject),
        );
        return {
          'status': switch (result.status) {
            ShareResultStatus.success => 'shared',
            ShareResultStatus.dismissed => 'dismissed',
            ShareResultStatus.unavailable => 'unavailable',
          },
        };
      });
    });

    final supported = _hasNotificationsAndLinks;
    _handle(BridgeHandler.notifyShow, supported: supported, (payload) {
      return _nativeCall(() => _notifications.show(payload));
    });
    _handle(BridgeHandler.notifySchedule, supported: supported, (payload) {
      return _nativeCall(() => _notifications.schedule(payload));
    });
    _handle(BridgeHandler.notifyCancel, supported: supported, (payload) {
      return _nativeCall(() => _notifications.cancel(payload));
    });
    _handle(BridgeHandler.notifyInitial, supported: supported, (_) async {
      await _startNativeServices();
      return _notifications.initial();
    });
    _handle(BridgeHandler.deeplinkInitial, supported: supported, (_) async {
      return {'url': await _deepLinks.initial()};
    });

    if (supported) {
      unawaited(_startNativeServices());
    }
  }

  /// 初始化通知、開始轉送連結。點通知與連結事件在網頁未連線時會被丟棄（與既有事件一致），
  /// 冷啟資訊另由 `notify_initial`／`deeplink_initial` 提供。
  Future<void> _startNativeServices() async {
    if (_nativeServicesStarted) {
      return;
    }
    _nativeServicesStarted = true;
    await _notifications.start((id, payload) {
      unawaited(emitter.emit(BridgeEvent.notifyTapped, {'id': id, 'payload': payload}));
    });
    await _deepLinks.listen((url) {
      unawaited(emitter.emit(BridgeEvent.deepLink, {'url': url}));
    });
  }

  // ---- File Picker ----
  void _registerPicker() {
    _handle(BridgeHandler.pickerPick, (payload) async {
      final mode = payload['mode'] as String? ?? 'file';
      final options = Map<String, dynamic>.from(payload['options'] as Map? ?? const {});
      final extensions = (options['extensions'] as List<dynamic>?)?.cast<String>();

      if (mode == 'directory') {
        final dir = await FilePicker.getDirectoryPath();
        return {'paths': dir != null ? [dir] : <String>[]};
      }

      final type = extensions != null ? FileType.custom : FileType.any;

      // file_picker 12 起單選改用 pickFile（pickFiles 的 allowMultiple 已標記淘汰）
      if (mode != 'files') {
        final file = await FilePicker.pickFile(type: type, allowedExtensions: extensions);
        return {'paths': file?.path != null ? [file!.path!] : <String>[]};
      }

      // file_picker 12 正式版起 pickFiles 回傳非空的 List<PlatformFile>（不再是 FilePickerResult?）；
      // 取消選取以空 list 表示。
      final files = await FilePicker.pickFiles(type: type, allowedExtensions: extensions);
      final paths = files.map((f) => f.path).whereType<String>().toList();
      return {'paths': paths};
    });
  }

  // ---- TCP ----
  void _registerTcp() {
    _handle(BridgeHandler.tcpConnect, (payload) async {
      return _tcp.connect(payload['host'] as String, payload['port'] as int);
    });
    _handle(BridgeHandler.tcpDisconnect, (payload) async {
      await _tcp.disconnect(payload['client'] as int);
      return {'ok': true};
    });
    _handle(BridgeHandler.tcpSend, (payload) async {
      final data = (payload['data'] as List<dynamic>).cast<int>();
      _tcp.send(payload['client'] as int, data);
      return {'ok': true};
    });
    _handle(BridgeHandler.tcpRead, (payload) async {
      return _tcp.read(
        payload['client'] as int,
        payload['expectLen'] as int,
        payload['timeoutMs'] as int,
      );
    });
    _handle(BridgeHandler.tcpDiagnose, (payload) async {
      final status = await _tcp.diagnose(payload['host'] as String, payload['port'] as int);
      return {'status': status};
    });
  }

  // ---- UI（方向 / 狀態列 / 最小化）----
  void _registerUi() {
    // 方向鎖定僅行動平台有意義；桌面的 setPreferredOrientations 是 no-op
    _handle(BridgeHandler.orientationLock, supported: _isMobile, (payload) async {
      await SystemChrome.setPreferredOrientations(_orientationsOf(payload['orientation'] as String?));
      return {'ok': true};
    });
    _handle(BridgeHandler.orientationUnlock, supported: _isMobile, (_) async {
      await SystemChrome.setPreferredOrientations(DeviceOrientation.values);
      return {'ok': true};
    });
    // 系統列：Android 走 MainActivity、iOS 走 SystemChrome；桌面無系統列可控（見 SystemBars.setVisible）
    _handle(BridgeHandler.statusBarShow, supported: _isMobile, (_) async {
      await SystemBars.setVisible(true);
      return {'ok': true};
    });
    _handle(BridgeHandler.statusBarHide, supported: _isMobile, (_) async {
      await SystemBars.setVisible(false);
      return {'ok': true};
    });
    _handle(BridgeHandler.statusBarImmersive, supported: _isMobile, (payload) async {
      final darkContent = (payload['darkContent'] as bool?) ?? false;
      SystemBars.applyOverlayStyle(darkContent: darkContent);
      // 沉浸模式的系統列是「可見但透明」；由 hidden 切入時仍是隱藏狀態，需明確喚回
      await SystemBars.setVisible(true);
      return {'ok': true};
    });
    _handle(BridgeHandler.themeSet, (payload) async {
      final dark = (payload['dark'] as bool?) ?? false;
      SystemBars.appBrightness.value = dark ? Brightness.dark : Brightness.light;
      return {'ok': true};
    });
    // 最小化需 MainActivity 的 moveTaskToBack（見 docs/android-wiring.md 的 MethodChannel 佈線）；
    // 未佈線平台雖仍回 {'ok': true}，但 capabilities 不含本項，網頁層可據此略過而非誤以為成功
    _handle(BridgeHandler.minimizeApp, supported: Platform.isAndroid, (_) async {
      try {
        await _hostChannel.invokeMethod<void>(HostMethod.minimize);
      }
      catch (_) {
        // 未佈線平台（iOS/桌面）安全略過
      }
      return {'ok': true};
    });
  }

  static const MethodChannel _hostChannel = MethodChannel(HostMethod.channel);

  List<DeviceOrientation> _orientationsOf(String? orientation) {
    switch (orientation) {
      case 'portrait':
        return [DeviceOrientation.portraitUp];
      case 'landscape':
        return [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight];
      default:
        return DeviceOrientation.values;
    }
  }
}

class _PluginContext implements AqutterPluginContext {
  _PluginContext(this._pluginId, this._emitter, this._permissions);

  final String _pluginId;
  final BridgeEmitter _emitter;
  final AqutterPermissions _permissions;

  @override
  Future<String> checkPermission(String type) => _permissions.check(type);

  @override
  Future<String> requestPermission(String type) => _permissions.request(type);

  @override
  Future<void> openPermissionSettings() => _permissions.openSettings();

  @override
  Future<void> emit(String event, Object? payload) {
    return _emitter.emit(aqutterPluginEventChannel(_pluginId, event), payload);
  }
}
