import 'package:package_info_plus/package_info_plus.dart';

/// 殼（原生二進位）自己的版本：`versionName` 與 build number。
///
/// 取自平台實際安裝的資訊（`package_info_plus`）而非 dart-define——flavor 在 Gradle /
/// Xcode 覆寫 versionName 時仍正確，手動 `flutter run` 也不需帶參數。
///
/// 兩個用途共用同一份：`bundle_info` 回給網頁端顯示，以及更新查詢時上行給伺服器
/// （並與回應的 `host.minBuildNumber` 比對）。
class HostVersion {
  const HostVersion({required this.name, required this.buildNumber, required this.buildNumberRaw});

  /// `versionName`（pubspec `version:` 的 `+` 之前，或平台覆寫值）。
  final String name;

  /// build number 的整數值；平台回的字串不是整數時為 null（此時不做最低版本比對）。
  final int? buildNumber;

  /// 平台回的原始 build number 字串，供顯示與除錯。
  final String buildNumberRaw;

  static Future<HostVersion>? _loading;

  /// 讀取一次後快取；安裝資訊在程序生命週期內不會改變。
  static Future<HostVersion> load() {
    return _loading ??= _read();
  }

  static Future<HostVersion> _read() async {
    final info = await PackageInfo.fromPlatform();
    return HostVersion(
      name: info.version,
      buildNumber: int.tryParse(info.buildNumber),
      buildNumberRaw: info.buildNumber,
    );
  }
}
