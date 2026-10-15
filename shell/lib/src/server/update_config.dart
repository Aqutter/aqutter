/// 版本查詢的 HTTP method。
///
/// 只開放 GET / POST：版本查詢在語意上是讀取，GET 是預設；POST 的存在是為了
/// 相容「只收 POST」的 API gateway，以及讓 client 現況能放進 request body。
enum UpdateHttpMethod {
  get('GET'),
  post('POST');

  const UpdateHttpMethod(this.wireName);

  /// 傳給 Dio `Options(method:)` 的字面值。
  final String wireName;

  /// 解析 `AQUTTER_UPDATE_METHOD`；留白視為未設定而回傳 [UpdateHttpMethod.get]，
  /// 其餘無法辨識的值一律拋 [ArgumentError]（不靜默 fallback 的理由見
  /// [BundleUpdateConfig.fromEnvironment]）。
  static UpdateHttpMethod parse(String raw) {
    final normalized = raw.trim().toUpperCase();
    if (normalized.isEmpty) {
      return UpdateHttpMethod.get;
    }
    for (final method in UpdateHttpMethod.values) {
      if (method.wireName == normalized) {
        return method;
      }
    }
    throw ArgumentError.value(
      raw,
      'AQUTTER_UPDATE_METHOD',
      'Unsupported HTTP method; expected one of '
          '${UpdateHttpMethod.values.map((m) => m.wireName).join(' / ')}',
    );
  }
}

/// 版本端點的預設路徑；沿用改為可配置之前的寫死值，確保既有部署行為不變。
const String kDefaultVersionPath = 'version.json';

/// API KEY 的預設 header 名。要改用 Bearer 時把 header 設為 `Authorization`、
/// 值填 `Bearer <token>` 即可，不需要另開一個維度。
const String kDefaultApiKeyHeader = 'X-Api-Key';

const String _envBaseUrl = String.fromEnvironment('AQUTTER_UPDATE_BASE_URL');
const String _envVersionPath = String.fromEnvironment('AQUTTER_UPDATE_VERSION_PATH');
const String _envMethod = String.fromEnvironment('AQUTTER_UPDATE_METHOD');
const String _envApiKey = String.fromEnvironment('AQUTTER_UPDATE_API_KEY');
const String _envApiKeyHeader = String.fromEnvironment('AQUTTER_UPDATE_API_KEY_HEADER');
const String _envBundleAuth = String.fromEnvironment('AQUTTER_UPDATE_BUNDLE_AUTH');
const String _envRequired = String.fromEnvironment('AQUTTER_UPDATE_REQUIRED');

/// OTA 熱更新的遠端契約設定。
///
/// 全部由 `--dart-define-from-file=.env/.env.<profile>` 於編譯期帶入（見專案的 .env 範例）。
/// 鍵一律帶 `AQUTTER_` 前綴——那是「只有殼在讀」的記號，網頁自己的環境變數不使用此前綴。
/// 每一項都有預設值，因此**既有 .env 不改也能跑**，行為與可配置化之前完全一致。
///
/// 設定的解析、驗證與 URL 組裝收攏於此，而非散在 `main.dart`——後者是畫面與生命週期
/// 的擁有者，不該同時是設定倉庫。
class BundleUpdateConfig {
  const BundleUpdateConfig({
    required this.baseUrl,
    this.versionPath = kDefaultVersionPath,
    this.method = UpdateHttpMethod.get,
    this.apiKey = '',
    this.apiKeyHeader = kDefaultApiKeyHeader,
    this.authorizeBundleDownload = true,
    this.requireVersionCheck = false,
  });

  /// 由編譯期 env 建構；未設定或留白的鍵一律落到建構子的預設值。
  ///
  /// 值無法辨識時直接拋出 [ArgumentError]，不做靜默 fallback——`AQUTTER_UPDATE_METHOD=Post`
  /// 這類打錯若默默退回 GET，症狀會是伺服器回 405，看起來像網路錯誤，遠比啟動即
  /// 報錯難查。呼叫端負責把它接進既有的錯誤畫面。
  factory BundleUpdateConfig.fromEnvironment() {
    final config = BundleUpdateConfig(
      baseUrl: _envBaseUrl.trim(),
      versionPath: _orDefault(_envVersionPath, kDefaultVersionPath),
      method: UpdateHttpMethod.parse(_envMethod),
      apiKey: _envApiKey.trim(),
      apiKeyHeader: _orDefault(_envApiKeyHeader, kDefaultApiKeyHeader),
      authorizeBundleDownload: parseFlag(
        _envBundleAuth,
        key: 'AQUTTER_UPDATE_BUNDLE_AUTH',
        defaultValue: true,
      ),
      requireVersionCheck: parseFlag(
        _envRequired,
        key: 'AQUTTER_UPDATE_REQUIRED',
        defaultValue: false,
      ),
    );
    config.assertConsistent();
    return config;
  }

  /// 「必須確認版本」卻沒有更新來源是矛盾配置：若默默視為未開啟，症狀會是
  /// 「以為有網路閘、其實離線也進得去」——那正是這個開關要防的事。比照
  /// [UpdateHttpMethod.parse] 的紀律，啟動即拋錯，不靜默退化。
  void assertConsistent() {
    if (requireVersionCheck && !enabled) {
      throw ArgumentError(
        'AQUTTER_UPDATE_REQUIRED=true requires a non-empty AQUTTER_UPDATE_BASE_URL',
      );
    }
  }

  /// 更新來源的 base URL（`AQUTTER_UPDATE_BASE_URL`）；空字串＝停用線上更新。
  final String baseUrl;

  /// 版本查詢的端點路徑（`AQUTTER_UPDATE_VERSION_PATH`），相對於 [baseUrl]。
  /// 可為靜態檔（`version.json`）或 API 路由（`v1/app/check-update`）。
  final String versionPath;

  /// 版本查詢的 HTTP method（`AQUTTER_UPDATE_METHOD`）。bundle 下載一律為 GET。
  final UpdateHttpMethod method;

  /// API KEY 的值（`AQUTTER_UPDATE_API_KEY`）；空字串＝不帶任何鑑權 header。
  final String apiKey;

  /// 承載 [apiKey] 的 header 名（`AQUTTER_UPDATE_API_KEY_HEADER`）。
  final String apiKeyHeader;

  /// 下載 bundle.zip 時是否一併帶上鑑權 header（`AQUTTER_UPDATE_BUNDLE_AUTH`）。
  ///
  /// 預設為真（自家後端）。zip 的 URL 由版本回應給定，可能指向第三方 CDN 的
  /// pre-signed URL——那種部署要設為 false，否則等於把 KEY 送給該網域。
  final bool authorizeBundleDownload;

  /// 是否要求版本查詢必須成功才能掛網頁（`AQUTTER_UPDATE_REQUIRED`）；預設為否。
  ///
  /// 開啟時本機已有種子包或先前更新過的版本也不放行——查詢成功同時當作
  /// 「網路可達、伺服器可達、版本已確認」的探針，適合離線就不該能用的 App。
  /// 失敗由 [BundleManager.checkForUpdate] 以 `UpdateCheckFailedException` 回報，
  /// 殼側改進阻擋畫面並提供重試。
  final bool requireVersionCheck;

  /// 是否啟用線上更新；[baseUrl] 為空即停用（與可配置化之前的語意一致）。
  bool get enabled => baseUrl.isNotEmpty;

  /// 版本查詢的完整 URI。
  ///
  /// 兩端的斜線各自去重後再接，讓 `https://host/app/` 與 `/version.json` 這種
  /// 常見的組合不會拼出 `//`。
  Uri get versionUri {
    final base = _stripTrailingSlash(baseUrl);
    final path = _stripLeadingSlash(versionPath);
    return Uri.parse('$base/$path');
  }

  /// 鑑權 header；未設 [apiKey] 時為空 map（呼叫端不需另行判斷）。
  Map<String, String> get authHeaders {
    if (apiKey.isEmpty) {
      return const <String, String>{};
    }
    return <String, String>{apiKeyHeader: apiKey};
  }

  /// 解析布林旗標；留白視為未設定而回傳 [defaultValue]，其餘無法辨識的值一律拋
  /// [ArgumentError]。[key] 只用於錯誤訊息，讓使用者一眼看出是哪個 env 鍵打錯。
  static bool parseFlag(String raw, {required String key, required bool defaultValue}) {
    final normalized = raw.trim().toLowerCase();
    if (normalized.isEmpty) {
      return defaultValue;
    }
    if (normalized == 'true') {
      return true;
    }
    if (normalized == 'false') {
      return false;
    }
    throw ArgumentError.value(raw, key, 'Expected true / false');
  }

  static String _orDefault(String raw, String fallback) {
    final trimmed = raw.trim();
    return trimmed.isEmpty ? fallback : trimmed;
  }

  static String _stripTrailingSlash(String value) {
    return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
  }

  static String _stripLeadingSlash(String value) {
    return value.startsWith('/') ? value.substring(1) : value;
  }

}

/// 網頁端於執行期覆寫的版更端點（切換版更伺服器用）。
///
/// 只涵蓋「去哪裡查、拿什麼鑑權」這幾項；[BundleUpdateConfig.requireVersionCheck]
/// 是啟動閘、[BundleUpdateConfig.authorizeBundleDownload] 決定 KEY 會不會送往第三方網域，
/// 兩者都不該由執行期輸入決定，一律沿用編譯期的值。
class UpdateEndpointOverride {
  const UpdateEndpointOverride({
    required this.baseUrl,
    this.versionPath,
    this.method,
    this.apiKey = '',
    this.apiKeyHeader,
  });

  /// 由網頁端 payload 或持久化的 JSON 建構；值無法辨識時拋 [ArgumentError]，
  /// 不做靜默 fallback（理由同 [BundleUpdateConfig.fromEnvironment]）。
  factory UpdateEndpointOverride.fromJson(Map<String, dynamic> json) {
    final baseUrl = _readString(json, 'baseUrl') ?? '';
    _assertHttpUrl(baseUrl);
    final method = _readString(json, 'method');
    return UpdateEndpointOverride(
      baseUrl: baseUrl.trim(),
      versionPath: _readString(json, 'versionPath'),
      method: method == null ? null : UpdateHttpMethod.parse(method),
      apiKey: _readString(json, 'apiKey') ?? '',
      apiKeyHeader: _readString(json, 'apiKeyHeader'),
    );
  }

  /// 新的更新來源 base URL；必為含 host 的 http / https 絕對 URI，**不得為空**——
  /// 要回到停用或編譯期預設請清除覆寫，而不是設成空字串。
  final String baseUrl;

  /// 版本查詢端點路徑；缺席沿用編譯期的 `AQUTTER_UPDATE_VERSION_PATH`。
  final String? versionPath;

  /// 版本查詢的 HTTP method；缺席沿用編譯期的 `AQUTTER_UPDATE_METHOD`。
  final UpdateHttpMethod? method;

  /// API KEY 的值；缺席即不帶任何鑑權 header。
  ///
  /// **刻意不沿用編譯期的 KEY**：覆寫通常指向另一台伺服器，沿用等於把原伺服器的
  /// KEY 送給新的網域。
  final String apiKey;

  /// 承載 [apiKey] 的 header 名；缺席沿用編譯期的 `AQUTTER_UPDATE_API_KEY_HEADER`。
  final String? apiKeyHeader;

  /// 疊在 [base]（編譯期預設）上得到有效設定。
  BundleUpdateConfig applyTo(BundleUpdateConfig base) {
    return BundleUpdateConfig(
      baseUrl: baseUrl,
      versionPath: versionPath ?? base.versionPath,
      method: method ?? base.method,
      apiKey: apiKey,
      apiKeyHeader: apiKeyHeader ?? base.apiKeyHeader,
      authorizeBundleDownload: base.authorizeBundleDownload,
      requireVersionCheck: base.requireVersionCheck,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'baseUrl': baseUrl,
      'versionPath': versionPath,
      'method': method?.wireName,
      'apiKey': apiKey,
      'apiKeyHeader': apiKeyHeader,
    };
  }

  /// 欄位缺席或為 null 回傳 null；留白視為缺席；型別不是字串即拋 [ArgumentError]。
  static String? _readString(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value == null) {
      return null;
    }
    if (value is! String) {
      throw ArgumentError.value(value, key, 'Expected a string');
    }
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static void _assertHttpUrl(String raw) {
    final uri = Uri.tryParse(raw.trim());
    final isHttp = uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
    if (!isHttp || uri.host.isEmpty) {
      throw ArgumentError.value(raw, 'baseUrl', 'Expected an absolute http(s) URL with a host');
    }
  }
}
