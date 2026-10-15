import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:aqutter_core/aqutter_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'aqutter_config.dart';
import 'plugin/aqutter_plugin.dart';
import 'bridge/bridge_emitter.dart';
import 'bridge/bridge_names.dart';
import 'bridge/bridge_registry.dart';
import 'bridge/safe_area_injector.dart';
import 'bridge/system_ui.dart';
import 'server/bundle_manager.dart';
import 'server/font_bootstrapper.dart';
import 'server/host_requirement.dart';
import 'server/host_updater.dart';
import 'server/local_server.dart';
import 'server/update_config.dart';
import 'server/update_config_store.dart';
import 'server/update_session.dart';
import 'ui/host_update_screen.dart';
import 'ui/startup_overlay.dart';
import 'ui/update_required_screen.dart';

/// dev server URL（`--dart-define=AQUTTER_DEV_URL=http://localhost:3000` 或 `--dart-define-from-file`）。
/// 非空 → dev 模式：WebView 直接載入 web dev server（HMR），跳過種子 / 熱更新 / 本機 server。
/// 空字串 → prod 模式：走種子 + 內嵌 shelf server。
const String kDevUrl = String.fromEnvironment('AQUTTER_DEV_URL');

/// WebView 是否開放遠端檢查（`AQUTTER_WEBVIEW_DEBUG`，`true` / `false`，留白＝`false`）。
///
/// 與其他 `AQUTTER_*` 一樣走 `--dart-define-from-file` 編譯期注入，因此是「每個 build 固定」的
/// 開關：UAT 的 release 包可以開、prod 包明確關。Android 的 debug build 因 `debuggable`
/// 旗標本就可 `chrome://inspect`，本開關的意義在 release build 與 Apple / Windows 平台。
const String _envWebViewDebug = String.fromEnvironment('AQUTTER_WEBVIEW_DEBUG');

/// 啟動 Aqutter 殼。App 的 `main()` 只需呼叫本函式。
Future<void> runAqutter({
  AqutterConfig config = const AqutterConfig(),
  List<AqutterPlugin> plugins = const [],
}) async {
  WidgetsFlutterBinding.ensureInitialized();
  // WebView 全屏 edge-to-edge：Android 需明確設定才會讓內容延伸到系統列後方
  // （對齊 bridge_registry.dart 的 statusbar_show；iOS 本即全屏，設定無害）。
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await _applyWebViewDebugFlag();
  runApp(AqutterApp(config: config, plugins: plugins));
}

/// 解析 `AQUTTER_WEBVIEW_DEBUG`；沿用 [BundleUpdateConfig.parseFlag] 的紀律——非 `true` / `false`
/// 啟動即拋錯，不靜默退化。
bool _webViewDebugEnabled() {
  return BundleUpdateConfig.parseFlag(
    _envWebViewDebug,
    key: 'AQUTTER_WEBVIEW_DEBUG',
    defaultValue: false,
  );
}

/// Android 的遠端檢查是 process 級的靜態開關（`WebView.setWebContentsDebuggingEnabled`），
/// 必須在任何 WebView 建立前設定；其他平台走 [AqutterWebViewSettings.isInspectable]，
/// 在建 WebView 時逐個帶入（見 `_AqutterPageState.build`）。該靜態方法僅 Android 有實作，
/// 其他平台呼叫會拋 UnimplementedError，故以平台守衛。
Future<void> _applyWebViewDebugFlag() async {
  if (!_webViewDebugEnabled()) {
    return;
  }
  if (defaultTargetPlatform != TargetPlatform.android) {
    return;
  }
  await AqutterWebViewController.setWebContentsDebuggingEnabled(true);
}

/// 實際採用的深淺色：App 主題（網頁經 `theme_set` 回報）優先於系統。
///
/// 使用者可把 App 主題固定為淺/深色而不動系統設定，此時原生的系統列圖示與底色
/// 若仍跟著系統，就會與網頁內容失去對比。網頁尚未回報前（冷啟動）退回系統值。
Brightness _effectiveBrightnessOf(BuildContext context) {
  return SystemBars.appBrightness.value ?? MediaQuery.platformBrightnessOf(context);
}

class AqutterApp extends StatelessWidget {
  const AqutterApp({
    super.key,
    this.config = const AqutterConfig(),
    this.plugins = const [],
  });

  final AqutterConfig config;
  final List<AqutterPlugin> plugins;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: config.title,
      debugShowCheckedModeBanner: false,
      home: AqutterPage(config: config, plugins: plugins),
    );
  }
}

class AqutterPage extends StatefulWidget {
  const AqutterPage({
    super.key,
    this.config = const AqutterConfig(),
    this.plugins = const [],
  });

  final AqutterConfig config;
  final List<AqutterPlugin> plugins;

  @override
  State<AqutterPage> createState() => _AqutterPageState();
}

class _AqutterPageState extends State<AqutterPage> {
  final BundleManager _bundleManager = BundleManager();
  final FontBootstrapper _fontBootstrapper = FontBootstrapper();
  final LocalWebServer _server = LocalWebServer();
  final BridgeEmitter _emitter = BridgeEmitter();
  final SafeAreaInjector _safeAreaInjector = SafeAreaInjector();

  BridgeRegistry? _registry;

  /// 字型服務根；於 [_bootstrap] 佈署一次後沿用。
  ///
  /// 字型隨 App 二進位走、不受網頁包更新影響，故執行期更新重啟 server 時不需重新佈署。
  /// 宣告為 late final 而非可空：唯一的讀取點 [_remountWebView] 由 WebView 內的 bridge
  /// 觸發，而 WebView 只在 [_bootstrap] 走完 prod 路徑後才掛載，屆時本欄位必然已賦值。
  late final String _fontsRoot;

  /// 熱更新的遠端契約設定倉庫：編譯期預設（由 .env 帶入，見專案的 .env 範例）疊上
  /// 網頁端於執行期覆寫的版更端點（切換伺服器）。
  ///
  /// 刻意在 [_bootstrap] 的 try 內建構而非欄位初始化：設定值無法辨識時
  /// [BundleUpdateConfig.fromEnvironment] 會拋錯，在此才能落到既有的錯誤畫面
  /// 而非直接崩潰。另一個讀取點 [_session] 由 WebView 內的 bridge 觸發，
  /// 而 WebView 只在 [_bootstrap] 走完後才掛載，屆時本欄位必然已賦值。
  late final UpdateConfigStore _configStore;

  Uri? _baseUrl;
  String? _error;

  /// 伺服器要求的殼版本高於本機時的阻擋狀態；非 null 即整個畫面改為 [HostUpdateScreen]。
  ///
  /// 與 [_error] 分開：後者是「壞了」，這個是「太舊」——出口不同，前者沒有出口，
  /// 後者的出口是更新殼。
  HostTooOldException? _hostTooOld;

  /// 嚴格模式下版本查詢失敗的阻擋狀態；非 null 即整個畫面改為 [UpdateRequiredScreen]。
  ///
  /// 第三種「不掛網頁」的狀態，與前兩者的差別在出口：[_error] 沒有、[_hostTooOld] 是
  /// 更新殼、這一個是重試——查詢成功就接回啟動流程。
  UpdateCheckFailedException? _updateCheckFailed;

  /// 阻擋畫面的更新器；只在 [_hostTooOld] 非 null 後才會被讀到，屆時 [_configStore] 必已賦值。
  late final HostUpdater _hostUpdater = HostUpdater(configStore: _configStore);

  /// 更新流程的狀態機；冷啟與網頁端指令共用同一條，狀態經 [_onUpdateState] 同時餵
  /// 過場與 bridge 事件。與 [_configStore] 同在 [_bootstrap] 建構。
  late final UpdateSession _session;

  /// **目前階段**的進度（0–1）；null 為不定量——比對版本階段尚無進度可言，
  /// 伺服器未回報 content-length 時亦然。
  double? _updateProgress;

  /// 上次回報的解包百分比；用於節流，避免逐項 setState。
  int _extractPercent = -1;

  /// 過場目前顯示的階段。
  StartupStage _stage = StartupStage.preparingBundle;

  /// 已經歷過的階段。過場據此區分「做完了」與「跳過了」——未啟用 OTA 時下載與
  /// 解包根本不會發生，把它們畫成已完成是不誠實的。
  final Set<StartupStage> _visitedStages = {StartupStage.preparingBundle};

  /// 過場是否仍掛在 [Stack] 上。淡出動畫需要元件留到動畫結束，故與 [_overlayVisible] 分開。
  bool _overlayMounted = true;

  /// 過場是否應顯示；轉為 false 即開始淡出。
  bool _overlayVisible = true;

  /// WebView 的重建代數。作為 [AqutterWebView] 的 key，每次重掛遞增以強制 Flutter
  /// 銷毀舊 element 並建立新的 platform view。
  ///
  /// 不能只靠「把 `_baseUrl` 設為 null 再設回來」——那依賴中間真的插進一個 frame，
  /// 而整段流程若在同一個 frame 內跑完（`await` 只讓出 microtask queue），element
  /// 會被原地重用，`initialUrlRequest` 換了也不生效，頁面因此完全沒有重新載入。
  int _webViewGeneration = 0;

  /// 是否正在處理網頁載入失敗（回滾中）。避免回滾後的重掛若再度失敗而遞迴。
  bool _recovering = false;

  /// 本代 WebView 是否已回報就緒。
  ///
  /// `app_ready` 與 `onLoadStop` **沒有保證的先後**——前者由網頁端的 JS 主動送出，
  /// 後者由原生的載入狀態機觸發。dev server 這種快的情境下 `app_ready` 會先到，
  /// 此時若照樣在 `onLoadStop` 起算就緒窗，那個窗永遠不會被取消，8 秒後就會把一個
  /// 已經正常運作的頁面誤判為壞掉。
  bool _webReady = false;

  /// 「頁面載入完成 → 收到 `app_ready`」的就緒判定窗。
  ///
  /// 刻意自 `onLoadStop` 起算，而**不是**自 WebView 掛上起算：載入本身要多久取決於
  /// 裝置與網頁包大小，對它設上限等於在慢速機器上把「慢」誤判為「壞」。載入都結束了
  /// 卻遲遲不回報就緒，才是網頁包真的有問題。
  Timer? _readyWindow;

  /// 就緒判定窗的長度。逾時代表**失敗**（走回滾），不是「放棄等待、把過場收掉」——
  /// 後者會讓壞掉的網頁包永久留在 `current/`，每次冷啟都壞卻看不出哪裡壞。
  ///
  /// **寧可高不可低**：這個值設低的代價不是「等太久」，而是把慢的裝置誤判為壞掉、
  /// 平白回滾掉一個其實正常的版本。以 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 調整（見專案的 .env 範例）。
  static const Duration _readyWindowTimeout = Duration(
    seconds: int.fromEnvironment('AQUTTER_WEB_READY_TIMEOUT_SECONDS', defaultValue: 300),
  );

  /// 上次套用的狀態列樣式依據；相同則不重複呼叫平台通道。
  Brightness? _lastBrightness;

  @override
  void initState() {
    super.initState();
    SystemBars.appBrightness.addListener(_onAppBrightnessChanged);
    _bootstrap();
  }

  /// MediaQuery 變化（旋轉、狀態列顯示/隱藏、系統深淺色切換）會觸發本回呼。
  ///
  /// 深淺色刻意由此取值而非 `didChangePlatformBrightness`：後者觸發時
  /// `platformDispatcher.platformBrightness` 仍可能是舊值，會套成反向的圖示明暗。
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _safeAreaInjector.inject(MediaQuery.paddingOf(context));
    _syncSystemOverlayStyle(_effectiveBrightnessOf(context));
  }

  /// 網頁改了 App 主題：重繪（Scaffold 底色）並重套系統列樣式。
  void _onAppBrightnessChanged() {
    if (!mounted) {
      return;
    }
    setState(() {});
    _syncSystemOverlayStyle(_effectiveBrightnessOf(context));
  }

  /// 系統列樣式：全屏後圖示直接疊在網頁的 `bg-surface` 上，需與其保持對比。
  /// 樣式常數與 bridge_registry.dart 的 statusbar_immersive 共用 [SystemBars]，避免互相覆蓋。
  void _syncSystemOverlayStyle(Brightness brightness) {
    if (brightness == _lastBrightness) {
      return;
    }
    _lastBrightness = brightness;
    SystemBars.applyOverlayStyle(darkContent: brightness == Brightness.dark);
  }

  /// 啟動流程：
  /// - dev（有 [kDevUrl]）：建立 bridge → 直接載入 dev server（HMR），跳過種子 / server。
  /// - prod：種子就緒 → 嘗試熱更新 → 啟動本機 server → 取得可載入 URL。
  Future<void> _bootstrap() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      _configStore = UpdateConfigStore(
        defaults: BundleUpdateConfig.fromEnvironment(),
        preferences: preferences,
      );
      _session = UpdateSession(
        bundle: _bundleManager,
        hostUpdater: _hostUpdater,
        configStore: _configStore,
        devMode: kDevUrl.isNotEmpty,
        onState: _onUpdateState,
        onApplyBundle: _applyPendingBundle,
        onHostTooOld: _blockOnHostTooOld,
        onCheckFailed: _blockOnUpdateCheckFailed,
      );
      _registry = BridgeRegistry(
        emitter: _emitter,
        preferences: preferences,
        bundle: _bundleManager,
        session: _session,
        onWebReady: _onWebReady,
        plugins: widget.plugins,
      );

      // dev：直接載入 web dev server，橋接照常註冊於 onWebViewCreated。
      // 種子 / OTA / server 全部跳過，故只經歷「載入網頁」一段。
      if (kDevUrl.isNotEmpty) {
        _mountWebView(Uri.parse(kDevUrl));
        return;
      }

      _setStage(StartupStage.preparingBundle);
      final documentRoot = await _bundleManager.ensureCurrent(
        onExtractProgress: _onExtractProgress,
      );
      // 上次「下載完但沒套用」（apply:false 後被殺）的 next/ 在此收尾；種子若更新，
      // 版本比對會把過時的 next/ 丟掉
      await _bundleManager.applyPending(onlyIfNewer: true);

      _setStage(StartupStage.preparingFonts);
      _fontsRoot = await _fontBootstrapper.ensureFonts();

      await _checkUpdateThenMount(documentRoot);
    }
    catch (e) {
      if (!mounted) {
        return;
      }
      setState(() => _error = '$e');
    }
  }

  /// 冷啟的尾段：查版本 → 起 server → 掛 WebView。獨立成方法是為了讓嚴格模式的
  /// 「重試」能從這裡重來，而不必重跑種子與字型佈署——那兩步與網路無關，
  /// 失敗的只有版本查詢。被阻擋（殼過舊、或嚴格模式查詢失敗）時不掛網頁。
  Future<void> _checkUpdateThenMount(String documentRoot) async {
    final blocked = await _tryHotUpdate();
    if (blocked) {
      return;
    }

    _setStage(StartupStage.startingServer);
    final baseUrl = await _server.start(documentRoot, fontsRoot: _fontsRoot);

    _mountWebView(baseUrl);
  }

  /// 嚴格模式阻擋畫面的「重試」：清掉阻擋狀態讓過場回到畫面上，再從查版本重來。
  ///
  /// 兩條進入阻擋的路徑（冷啟、網頁端觸發的更新）都收斂到同一個出口：查詢成功後
  /// 一律以 `current/` 重新起 server 並掛 WebView。網頁端那條路徑的 WebView 早已卸下，
  /// 冷啟那條則從未掛過，兩者在此已無差別。
  Future<void> _retryVersionCheck() async {
    setState(() {
      _updateCheckFailed = null;
      _visitedStages.clear();
    });
    _showOverlay(StartupStage.checkingUpdate);
    try {
      await _checkUpdateThenMount(await _bundleManager.currentPath());
    }
    catch (e) {
      if (!mounted) {
        return;
      }
      setState(() => _error = '$e');
    }
  }

  /// 熱更新為非致命：失敗僅記錄，續用現有版本（rollback 安全）。
  /// 兩個例外會回傳 true 讓呼叫端停在阻擋畫面、不掛網頁：殼過舊（不是「這次更新失敗」
  /// 而是「不准繼續」），以及嚴格模式下的查詢失敗（[BundleManager] 已依
  /// `AQUTTER_UPDATE_REQUIRED` 判定過，這裡只負責切畫面）。
  ///
  /// 走 [UpdateSession] 的分段 API 而非一條龍：過場與 bridge 事件都吃同一份狀態，
  /// 進度不必再各接一套回呼。`runExclusive` 佔住 session，網頁一掛上就發指令也會被拒。
  Future<bool> _tryHotUpdate() async {
    if (!_configStore.current.enabled) {
      return false;
    }
    return _session.runExclusive(() async {
      try {
        final result = await _session.check();
        if (result.hostBlocked) {
          _blockOnHostTooOld(result.hostTooOld);
          return true;
        }
        if (result.hasUpdate) {
          await _session.downloadBundle(result, apply: false);
          await _bundleManager.applyPending();
        }
      }
      on UpdateCheckFailedException catch (e) {
        _blockOnUpdateCheckFailed(e);
        return true;
      }
      catch (e) {
        debugPrint('[Aqutter] hot-update skipped: $e');
      }
      return false;
    });
  }

  void _blockOnUpdateCheckFailed(UpdateCheckFailedException e) {
    debugPrint('[Aqutter] blocked: $e');
    if (!mounted) {
      return;
    }
    setState(() => _updateCheckFailed = e);
  }

  void _blockOnHostTooOld(HostTooOldException e) {
    debugPrint('[Aqutter] blocked: $e');
    if (!mounted) {
      return;
    }
    setState(() => _hostTooOld = e);
  }

  /// 切換過場階段；下載以外的階段一律回到不定量進度。
  void _setStage(StartupStage stage) {
    if (!mounted) {
      return;
    }
    setState(() {
      _stage = stage;
      _visitedStages.add(stage);
      _updateProgress = null;
    });
  }

  /// 掛上 WebView。
  ///
  /// 過場**不在此移除**——WebView 此刻才開始載入，正是原本完全沒有回饋的那一段。
  /// 就緒判定窗也不在此起算，而是等 `onLoadStop`（見 [_onLoadStop]）。
  void _mountWebView(Uri baseUrl) {
    if (!mounted) {
      return;
    }
    _webReady = false;
    setState(() {
      _baseUrl = baseUrl;
      _stage = StartupStage.loadingWeb;
      _visitedStages.add(StartupStage.loadingWeb);
      _updateProgress = null;
      _webViewGeneration++;
    });
  }

  /// 網頁回報就緒（`app_ready`）：淡出過場。
  ///
  /// 會隨 WebView 每次重掛而再次觸發（套用網頁包更新後），故必須可重入。
  void _onWebReady() {
    _readyWindow?.cancel();
    _webReady = true;
    _recovering = false;
    _dismissOverlay();
  }

  /// 頁面載入結束後才起算就緒判定窗；逾時視為網頁包壞掉。
  ///
  /// 已經收到 `app_ready` 就不必再等——它可能比 `onLoadStop` 更早抵達。
  ///
  /// dev 模式**不套用**本判定：這個窗的用途是抓出壞掉的網頁包，而 dev 沒有網頁包
  /// （載的是 dev server），失敗也無處可退。且 dev 的頁面在 `onLoadStop` 之後還要
  /// 逐一抓數百個未打包的模組，就緒本來就會晚得多——對它設上限只會把「慢」誤判為
  /// 「壞」。dev 若真的起不來，開發者手上就有 console 與 dev server 的輸出。
  void _startReadyWindow() {
    if (_webReady || kDevUrl.isNotEmpty) {
      return;
    }
    _readyWindow?.cancel();
    _readyWindow = Timer(_readyWindowTimeout, () {
      _handleWebFailure('app_ready not received within ${_readyWindowTimeout.inSeconds}s after load');
    });
  }

  /// 網頁起不來的統一入口：載入錯誤、HTTP 錯誤、或載完卻不回報就緒。
  ///
  /// 這裡**不**收掉過場了事。收掉只是讓失敗看不見，而壞掉的網頁包已經是 `current/`，
  /// 之後每次冷啟都會壞——強制版更情境下等同讓遠端一次推壞全部裝置。改為回滾到
  /// 前一版並重掛；沒有前一版可退時才落到錯誤畫面，讓失敗至少是可見的。
  Future<void> _handleWebFailure(String reason) async {
    if (!mounted || _recovering) {
      return;
    }
    _readyWindow?.cancel();
    debugPrint('[Aqutter] web failed to become ready: $reason');

    // dev 模式載入的是 dev server，沒有網頁包可退。能走到這裡的只剩載入層級的錯誤
    // （dev server 沒開、位址不通），那正是開發者需要立刻看到的東西。
    if (kDevUrl.isNotEmpty) {
      setState(() => _error = 'dev server 載入失敗\n$reason');
      return;
    }

    _recovering = true;
    setState(() {
      _baseUrl = null;
      _visitedStages.clear();
    });
    _showOverlay(StartupStage.rollingBack);
    // 與 [_applyPendingBundle] 同一個理由：讓出一個 frame，確保舊 WebView 真的被銷毀
    await WidgetsBinding.instance.endOfFrame;

    await _server.stop();
    final rolledBack = await _bundleManager.rollbackToPrevious();
    if (!rolledBack) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = '網頁包無法載入，且沒有可回復的前一版\n$reason';
      });
      return;
    }

    await _remountWebView();
  }

  void _dismissOverlay() {
    if (!mounted || !_overlayVisible) {
      return;
    }
    setState(() => _overlayVisible = false);
  }

  /// 淡出動畫結束：把過場自 [Stack] 移除，之後不再參與 build。
  void _onOverlayHidden() {
    if (!mounted) {
      return;
    }
    setState(() => _overlayMounted = false);
  }

  /// 重新顯示過場（執行期更新）；WebView 於此期間被卸下。
  void _showOverlay(StartupStage stage) {
    setState(() {
      _stage = stage;
      _visitedStages.add(stage);
      _overlayMounted = true;
      _overlayVisible = true;
      _updateProgress = null;
    });
  }

  /// 套用已下載的網頁包（[UpdateSession.onApplyBundle]）：卸下 WebView 由原生畫面接管，
  /// 停 server、把 `next/` 換上，再以新內容重啟 server 並把 WebView 掛回去。
  ///
  /// 先卸下 WebView 才動服務根——此時已無 in-flight 請求，可避開「server 服務中刪除
  /// documentRoot」的競態與 Windows 檔案鎖定。這是整條更新流程中**唯一**需要網頁不在的
  /// 一段：下載與解包都在 `next/`，網頁活著時就已在背景做完。
  Future<void> _applyPendingBundle() async {
    if (!mounted) {
      return;
    }
    setState(() {
      _baseUrl = null;
      // 每次套用都是一次新的流程，步驟清單要從頭算起——沿用冷啟時的紀錄會讓
      // 這次根本沒發生的步驟顯示為「完成」。
      _visitedStages.clear();
    });
    _showOverlay(StartupStage.applyingUpdate);

    // 讓出一個 frame，確保「WebView 不在樹上」這個狀態真的被建構過一次。
    // 少了這行，下方的 await 若全部在 microtask 內完成，Flutter 從未以「children 只剩過場」
    // 重建過，AqutterWebView 的 element 會被原地重用——換了 initialUrlRequest 也不生效。
    await WidgetsBinding.instance.endOfFrame;

    try {
      await _server.stop();
      await _bundleManager.applyPending();
    }
    catch (e) {
      // 套用失敗不致命：既有 current/ 已被保留，下方會以舊版重新掛回
      debugPrint('[Aqutter] bundle apply failed: $e');
    }

    await _remountWebView();
  }

  /// [UpdateSession] 的狀態分派：WebView 在時推 `update_state` 事件給網頁；過場在時
  /// 把下載／解包階段映射到 [StartupStage]。兩者不互斥——套用前的 `applying` 兩邊都收。
  ///
  /// 進度一旦開始回報即代表確實有新版要下載，故順道把階段切過去——冷啟時
  /// [_tryHotUpdate] 只知道「要去檢查」，有沒有東西可下載得等伺服器回應才曉得。
  void _onUpdateState(UpdateState state) {
    if (_baseUrl != null) {
      unawaited(_emitter.emit(BridgeEvent.updateState, state.toJson()));
    }
    if (!mounted || !_overlayMounted || state.target != UpdateTarget.bundle) {
      return;
    }
    final stage = switch (state.stage) {
      UpdateStage.checking => StartupStage.checkingUpdate,
      UpdateStage.downloading => StartupStage.downloadingUpdate,
      UpdateStage.extracting => StartupStage.extracting,
      _ => null,
    };
    if (stage == null) {
      return;
    }
    setState(() {
      _stage = stage;
      _visitedStages.add(stage);
      final percent = state.percent;
      _updateProgress = percent == null ? null : percent / 100;
    });
  }

  /// 解包進度回呼。與下載同理，進度一旦開始回報即代表確實在解包，故順道切階段。
  ///
  /// **回呼很密集**（大包數百項），故只在整數百分比變動時才 setState——
  /// 逐項重建畫面會讓解包本身變慢，而人眼也看不出 0.3% 的差別。
  void _onExtractProgress(int done, int total) {
    if (!mounted || total <= 0) {
      return;
    }
    final percent = (done * 100) ~/ total;
    if (_stage == StartupStage.extracting && percent == _extractPercent) {
      return;
    }
    _extractPercent = percent;
    setState(() {
      _stage = StartupStage.extracting;
      _visitedStages.add(StartupStage.extracting);
      _updateProgress = percent / 100;
    });
  }

  /// WebView 的載入進度（0–100）。只在 `loadingWeb` 階段採用——其餘階段的畫面
  /// 屬於原生流程，WebView 的載入百分比在那裡沒有意義。
  void _onWebViewProgress(int progress) {
    if (!mounted || _stage != StartupStage.loadingWeb) {
      return;
    }
    setState(() => _updateProgress = progress / 100);
  }

  /// 以目前的服務根重啟 server 並把 WebView 掛回；失敗則落到錯誤畫面。
  Future<void> _remountWebView() async {
    try {
      final baseUrl = await _server.start(
        await _bundleManager.currentPath(),
        fontsRoot: _fontsRoot,
      );
      if (!mounted) {
        return;
      }
      _webReady = false;
      setState(() {
        _baseUrl = baseUrl;
        _stage = StartupStage.loadingWeb;
        _visitedStages.add(StartupStage.loadingWeb);
        _updateProgress = null;
        _webViewGeneration++;
      });
    }
    catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _updateProgress = null;
        _error = '$e';
      });
    }
  }

  void _onWebViewCreated(AqutterWebViewController controller) {
    _emitter.controller = controller;
    _safeAreaInjector.controller = controller;
    _registry?.register(controller);
  }

  /// 頁面（重）載入會清掉 documentElement 的 inline style（dev HMR full reload 亦同），
  /// 故強制重注入 safe-area 變數。
  void _onLoadStop(AqutterWebViewController controller, AqutterWebUri? url) {
    _safeAreaInjector.inject(MediaQuery.paddingOf(context), force: true);
    // 載入結束才開始等 app_ready；在此之前的耗時屬於「載入」，不該被判定為失敗。
    _startReadyWindow();
  }

  /// Android 實體返回鍵：不直接 pop，改派事件給前端由其決定 router.back / 最小化。
  void _onPopInvoked(bool didPop, Object? result) {
    if (didPop) {
      return;
    }
    _emitter.emit(BridgeEvent.androidBack, const {});
  }

  @override
  void dispose() {
    SystemBars.appBrightness.removeListener(_onAppBrightnessChanged);
    _readyWindow?.cancel();
    _registry?.disposePlugins();
    _server.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _ErrorScaffold(message: '啟動失敗\n$_error', config: widget.config);
    }

    final brightness = _effectiveBrightnessOf(context);
    final hostTooOld = _hostTooOld;
    if (hostTooOld != null) {
      return HostUpdateScreen(
        requirement: hostTooOld.requirement,
        host: hostTooOld.host,
        updater: _hostUpdater,
        backgroundColor: widget.config.surfaceOf(brightness),
        foregroundColor: widget.config.onSurfaceOf(brightness),
        accentColor: widget.config.primaryOf(brightness),
      );
    }

    final updateCheckFailed = _updateCheckFailed;
    if (updateCheckFailed != null) {
      return UpdateRequiredScreen(
        failure: updateCheckFailed,
        onRetry: _retryVersionCheck,
        backgroundColor: widget.config.surfaceOf(brightness),
        foregroundColor: widget.config.onSurfaceOf(brightness),
        accentColor: widget.config.primaryOf(brightness),
      );
    }

    final baseUrl = _baseUrl;
    final content = Scaffold(
      backgroundColor: widget.config.surfaceOf(brightness),
      // 鍵盤彈出時刻意沿用 framework 預設的 resizeToAvoidBottomInset: true，讓 WebView
      // 本身縮成「螢幕高 − 鍵盤高」——網頁的 layout viewport 因此真的變小，捲動容器的
      // 頂端與底端都捲得到。曾改為 false 並交給 fork 的 keyboardAvoidance 平移 WebView，
      // 但平移模型是「拿頂部換底部」：整塊上推 S px 後頂部就少 S、底部仍壓著 K − S，
      // 兩端不可能同時可見。代價是鍵盤動畫期間 framework 會逐幀 re-layout WebView，
      // 與 _buildWebView 的 keyboardAvoidance: false 成對；詳見 wiki 的 keyboard-avoidance。
      //
      // 過場疊在 WebView 之上而非與之二選一：WebView 掛上後到網頁首次繪製之間，
      // 原本完全沒有回饋，那正是使用者最容易誤以為當掉的一段。
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (baseUrl != null) _buildWebView(baseUrl),
          // plugin 的原生 UI：在 WebView 之上、啟動過場之下
          if (baseUrl != null)
            for (final plugin in widget.plugins)
              ?plugin.buildOverlay(context),
          if (_overlayMounted)
            StartupOverlay(
              stage: _stage,
              backgroundColor: widget.config.surfaceOf(brightness),
              foregroundColor: widget.config.onSurfaceOf(brightness),
              indicatorColor: widget.config.primaryOf(brightness),
              visible: _overlayVisible,
              onHidden: _onOverlayHidden,
              progress: _updateProgress,
              visitedStages: _visitedStages,
            ),
        ],
      ),
    );

    // WebView 尚未掛上時不攔返回鍵：此時 [_onPopInvoked] 送出的事件無人接收，
    // 攔下來只會讓卡在啟動階段的使用者無法退出（此為改版前的既有行為）。
    if (baseUrl == null) {
      return content;
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: _onPopInvoked,
      // 不包 SafeArea：WebView 全屏 edge-to-edge，插邊交由 SafeAreaInjector 注入
      // 給網頁端的 AppSafeArea 處理，避免原生與網頁各留一次白。
      child: content,
    );
  }

  Widget _buildWebView(Uri baseUrl) {
    return AqutterWebView(
      // key 隨每次重掛遞增：強制 Flutter 銷毀舊 element 並建立新的 platform view。
      // initialUrlRequest 只在建立當下讀取，element 被原地重用時換了也不生效。
      key: ValueKey(_webViewGeneration),
      initialUrlRequest: AqutterURLRequest(url: AqutterWebUri.uri(baseUrl)),
      initialSettings: AqutterWebViewSettings(
        javaScriptEnabled: true,
        // 允許載入本機 http server（loopback）
        mixedContentMode: AqutterMixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
        // iOS：關閉 scrollView 的自動 safe-area 內縮，否則會與網頁端的
        // --safe-area-* 留白疊加成雙倍間距。
        contentInsetAdjustmentBehavior: AqutterScrollViewContentInsetAdjustmentBehavior.NEVER,
        // 關掉 fork 的原生鍵盤避讓（預設 true）。Android 端它會吃掉 IME 插邊並平移整個
        // WebView，網頁因此永遠不知道鍵盤存在、window.visualViewport 也不再變化；iOS 端則
        // 補鍵盤高度的 contentInset。兩者都與上方 Scaffold 讓 WebView 真正縮小的做法衝突
        // （前者是頂底二擇一的平移，後者會疊成雙倍留白），故全平台一律關閉，改由 Chromium /
        // WebKit 自己在縮小後的 viewport 內捲焦點欄位——此時它們是唯一的搬動者。
        keyboardAvoidance: false,
        // 禁止縮放：這是 app 殼而非閱讀型網站，捏合／雙擊把整個畫面放大會破壞版面。
        // 套件預設兩者皆為 true，故必須明寫關閉。
        // supportZoom 是唯一四平台皆支援的開關，各自對應：
        //   Android → WebSettings.setSupportZoom
        //   iOS / macOS → WKWebView
        //   Windows → ICoreWebView2Settings.put_IsZoomControlEnabled
        // builtInZoomControls 為 Android 專屬（手勢與螢幕上的縮放控制項）。
        // iOS 的 min/maximumZoomScale 預設已是 1.0，無需另設。
        supportZoom: false,
        builtInZoomControls: false,
        // iOS / macOS：允許 <video> 在頁面內播放。WebKit 預設為 false，會讓所有影片
        // 一律交給原生全螢幕播放器接手——網頁的 playsinline 屬性在 WKWebView 下擋不住
        // 這個行為，必須由宿主放行。Android 與 Windows 不受此設定影響，本來就 inline。
        //
        // 刻意不動 mediaPlaybackRequiresUserGesture（預設 true）：那條放寬的是「不需使用者
        // 手勢即可播放」，影響範圍是整個 app 的所有影音，代價與這裡要解決的問題不對等。
        allowsInlineMediaPlayback: true,
        // iOS 16.4+ / macOS 13.3+ 的 Safari Web Inspector 與 Windows WebView2 的 DevTools；
        // Android 忽略此鍵，由 main() 的靜態開關處理（見 _applyWebViewDebugFlag）。
        isInspectable: _webViewDebugEnabled(),
      ),
      onWebViewCreated: _onWebViewCreated,
      onLoadStop: _onLoadStop,
      onProgressChanged: (controller, progress) => _onWebViewProgress(progress),
      // 載入層級的錯誤直接判定失敗，不必等就緒窗——此時已確定網頁包起不來。
      // 子框架與子資源的錯誤刻意不處理：那些不代表主文件失敗（見 isForMainFrame）。
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame ?? false) {
          _handleWebFailure('load error: ${error.description}');
        }
      },
      onReceivedHttpError: (controller, request, response) {
        if (request.isForMainFrame ?? false) {
          _handleWebFailure('http error: ${response.statusCode}');
        }
      },
    );
  }
}

/// 錯誤畫面。啟動與更新的過場已移交 [StartupOverlay]，此處只留最小的訊息呈現。
class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.message, required this.config});

  final String message;
  final AqutterConfig config;

  @override
  Widget build(BuildContext context) {
    final brightness = _effectiveBrightnessOf(context);
    return Scaffold(
      backgroundColor: config.surfaceOf(brightness),
      body: Center(
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: config.onSurfaceOf(brightness)),
        ),
      ),
    );
  }
}
