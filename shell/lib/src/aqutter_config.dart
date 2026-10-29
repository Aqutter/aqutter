import 'package:flutter/widgets.dart';

import 'package:aqutter_core/aqutter_core.dart';

import 'bridge/log_retention.dart';

/// 殼的外觀設定，由 App 的 `main()` 傳給 `runAqutter`。
///
/// 殼在網頁尚未繪製、iOS 回彈捲動、啟動過場與錯誤畫面時會露出原生底色。這些顏色
/// 應與網頁的 surface / onSurface / primary 色票一致，否則會成為與內容不連續的色塊。
///
/// 底色、前景色與強調色都由設定自己持有：殼不依賴 Material 或 Cupertino（沒有 `ThemeData`），
/// 每個畫面的底色與文字色都從這裡取，深色模式下才不會對撞成近乎不可讀的對比度。
/// [AqutterConfig.webPermissions] 的預設值：相機與麥克風。
/// 列舉值不是編譯期常數，所以 config 以 null 代表預設，用到時才取這份。
final Set<AqutterPermissionResourceType> defaultWebPermissions = {
  AqutterPermissionResourceType.CAMERA,
  AqutterPermissionResourceType.MICROPHONE,
  AqutterPermissionResourceType.CAMERA_AND_MICROPHONE,
};

class AqutterConfig {
  const AqutterConfig({
    this.title = 'Aqutter App',
    this.surfaceLight = const Color(0xFFF4FBFA),
    this.surfaceDark = const Color(0xFF0E1514),
    this.onSurfaceLight = const Color(0xFF161D1D),
    this.onSurfaceDark = const Color(0xFFDDE4E3),
    this.primaryLight = const Color(0xFF006A6A),
    this.primaryDark = const Color(0xFF80D5D4),
    this.logRetention = const LogRetention(),
    this.webPermissions,
  });

  /// `MaterialApp.title`（工作切換器中顯示的名稱）。
  final String title;

  /// 過場與 WebView 底層的背景色。
  final Color surfaceLight;
  final Color surfaceDark;

  /// 原生自繪畫面（過場、錯誤）的前景色。
  final Color onSurfaceLight;
  final Color onSurfaceDark;

  /// 進度指示器等強調色。
  final Color primaryLight;
  final Color primaryDark;

  /// 殼的預設日誌目錄保留策略（預設 14 天、20 MiB）；設為 `LogRetention.unlimited` 則不清理。
  /// 只清理預設目錄，網頁以 `target` 指定的位置不受影響。
  final LogRetention logRetention;

  /// 網頁（`getUserMedia` 等）可取得的 WebView 資源；預設為相機與麥克風。
  /// 只對殼自己供應的頁面生效，且要求的資源必須全數在此集合內，否則整個拒絕。
  /// 系統層仍要使用者授權，plugin 可用 `AqutterPluginContext.requestPermission` 先要。
  /// null（預設）代表 [defaultWebPermissions]。
  final Set<AqutterPermissionResourceType>? webPermissions;

  /// 依深淺色取用底色。
  Color surfaceOf(Brightness brightness) {
    return brightness == Brightness.dark ? surfaceDark : surfaceLight;
  }

  /// 依深淺色取用前景色（文字）。
  Color onSurfaceOf(Brightness brightness) {
    return brightness == Brightness.dark ? onSurfaceDark : onSurfaceLight;
  }

  /// 依深淺色取用強調色。
  Color primaryOf(Brightness brightness) {
    return brightness == Brightness.dark ? primaryDark : primaryLight;
  }
}
