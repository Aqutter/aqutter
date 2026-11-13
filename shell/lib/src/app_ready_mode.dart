import 'server/update_config.dart';

/// 判定本次是否要求網頁呼叫 `app_ready`（嚴格模式），對應編譯期鍵 `AQUTTER_REQUIRE_APP_READY`。
///
/// - 空（預設）＝自動：[updateBaseUrl]（`AQUTTER_UPDATE_BASE_URL`）非空才嚴格。嚴格檢查的保護——
///   逾時就把網頁包視為壞掉並回滾——只對熱更新有意義；沒用熱更新時沒有前一版可退，
///   卻最容易讓第一次使用的人卡在「載入網頁」。
/// - `true`＝嚴格：載入完成後必須收到 `app_ready`。
/// - `false`＝不要求：載入完成後由殼自行收起過場，即使設了熱更新網址也不做逾時回滾。
///
/// 非 `true` / `false` / 空的值拋 [ArgumentError]，沿用 [BundleUpdateConfig.parseFlag] 的紀律。
bool requiresAppReady({required String flag, required String updateBaseUrl}) {
  if (flag.trim().isEmpty) {
    return updateBaseUrl.trim().isNotEmpty;
  }
  return BundleUpdateConfig.parseFlag(
    flag,
    key: 'AQUTTER_REQUIRE_APP_READY',
    defaultValue: false,
  );
}

/// 在頁面內等兩個 `requestAnimationFrame` 後結束。
///
/// 非嚴格模式用它判定「頁面至少畫過一次」：`onLoadStop` 只代表 document 載完，hydration
/// 與首次繪製都還沒發生，立刻收起過場仍會露出空白；等兩幀能避開大部分空白，但無法保證
/// 單頁應用已完成 hydration——需要完全無空白的專案請改用嚴格模式並自行呼叫 `app_ready`。
const String kAfterTwoFramesScript =
    'await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));'
    'return true;';

/// 等待兩幀的上限。視窗在背景時瀏覽器會暫停 `requestAnimationFrame`，不設上限過場就永遠不收。
const Duration kAfterTwoFramesTimeout = Duration(seconds: 2);
