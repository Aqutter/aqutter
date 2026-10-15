import 'host_version.dart';

/// 殼更新的管道；由版本回應的 `host.updateType` 指定。
enum HostUpdateType {
  /// 開外部連結（商店頁、iOS 企業派發的 `itms-services://`、任何下載頁）。
  external('external'),

  /// 非上架 Android：App 內下載 APK 後喚起系統安裝器。非 Android 平台退回 [external]。
  apk('apk');

  const HostUpdateType(this.wireName);

  /// 回應 JSON 裡的字面值。
  final String wireName;

  /// 缺席或留白為 [external]；無法辨識的值拋 [FormatException]——伺服器打錯字
  /// 若默默退回 external，症狀會是「按了按鈕卻開了瀏覽器」，比報錯難查。
  static HostUpdateType parse(Object? raw) {
    if (raw == null) {
      return HostUpdateType.external;
    }
    final normalized = raw.toString().trim().toLowerCase();
    if (normalized.isEmpty) {
      return HostUpdateType.external;
    }
    for (final type in HostUpdateType.values) {
      if (type.wireName == normalized) {
        return type;
      }
    }
    throw FormatException('Unsupported host.updateType: $raw');
  }
}

/// 版本回應的 `host` 區塊，已依本機平台把預設欄位與平台覆寫合併過。
///
/// 為何是巢狀「預設 + 平台覆寫」而非扁平欄位：GET 模式的靜態 `version.json` 只有一份，
/// 扁平欄位無法同時給 Android APK 與 iOS `itms-services://`，各平台的 build number
/// 也不該假設一致。POST 模式伺服器已知平台，可只寫頂層欄位。
class HostRequirement {
  const HostRequirement({
    this.minBuildNumber,
    this.updateUrl,
    this.updateType = HostUpdateType.external,
    this.updateSha256,
    this.updateSize,
  });

  /// 本網頁包所需的最低殼 build number；null＝不限制。
  final int? minBuildNumber;

  /// 更新管道的 URL；null＝阻擋畫面只顯示訊息、無按鈕。
  final String? updateUrl;

  /// 更新管道型別。
  final HostUpdateType updateType;

  /// `apk` 型別的安裝檔 sha256（十六進位）；null＝不驗。
  final String? updateSha256;

  /// 安裝檔大小（bytes）；供下載前顯示，null＝伺服器未宣告。
  /// 下載期間仍以 content-length 為準，只在其缺席時回退用這個值。
  final int? updateSize;

  /// 頂層欄位為預設，`json[platform]`（鍵名同 `Platform.operatingSystem`）逐欄覆寫。
  factory HostRequirement.fromJson(Map<String, dynamic> json, {required String platform}) {
    final override = json[platform];
    final merged = <String, dynamic>{
      ...json,
      if (override is Map<String, dynamic>) ...override,
    };
    return HostRequirement(
      minBuildNumber: _asInt(merged['minBuildNumber']),
      updateUrl: _asNonEmptyString(merged['updateUrl']),
      updateType: HostUpdateType.parse(merged['updateType']),
      updateSha256: _asNonEmptyString(merged['updateSha256']),
      updateSize: _asInt(merged['updateSize']),
    );
  }

  /// 殼是否低於要求。殼的 build number 解析不出整數時**不阻擋**——那是無法比對，
  /// 不是最舊；把它當最舊會讓所有 iOS 非整數 CFBundleVersion 的安裝全部被鎖死。
  bool blocks(HostVersion host) {
    final required = minBuildNumber;
    final current = host.buildNumber;
    if (required == null || current == null) {
      return false;
    }
    return current < required;
  }

  static int? _asInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is String) {
      return int.tryParse(value.trim());
    }
    return null;
  }

  static String? _asNonEmptyString(Object? value) {
    if (value is! String) {
      return null;
    }
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

/// 殼低於伺服器要求；[BundleManager.check] 於下載網頁包之前拋出。
///
/// 獨立型別而非 [StateError]：呼叫端要把它與其他更新失敗分開處理——後者續用舊版即可，
/// 這個要阻擋畫面。
class HostTooOldException implements Exception {
  const HostTooOldException({required this.requirement, required this.host});

  /// 伺服器的要求（已合併平台覆寫）。
  final HostRequirement requirement;

  /// 本機殼版本。
  final HostVersion host;

  @override
  String toString() {
    return 'HostTooOldException: build ${host.buildNumberRaw} < required ${requirement.minBuildNumber}';
  }
}
