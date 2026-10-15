import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'update_config.dart';

/// 覆寫值在 `shared_preferences` 的鍵。帶 `host.` 前綴，避開網頁端 KV handler 的鍵空間。
const String kUpdateOverridePreferenceKey = 'host.updateConfigOverride';

/// 持有「目前生效」的版更設定：網頁端覆寫（若有）疊在編譯期預設之上。
///
/// 之所以不直接改 [BundleUpdateConfig]：它是不可變的編譯期設定物件，且 `UpdateSession`、
/// `HostUpdater` 原本都各持一份。改為向本類別取 [current]，讓切換伺服器只有一個寫入點。
///
/// 覆寫值持久化於 `shared_preferences`，冷啟自動沿用。`preferences` 為 null 時只存在記憶體
/// （測試與無持久化情境）。
class UpdateConfigStore {
  UpdateConfigStore({required this.defaults, SharedPreferences? preferences})
    // 具名參數不能以私有名稱宣告，故無法用 initializing formal
    // ignore: prefer_initializing_formals
    : _preferences = preferences {
    _override = _load();
    _current = _compose(_override);
  }

  /// 編譯期預設；清除覆寫時回到它。
  final BundleUpdateConfig defaults;

  final SharedPreferences? _preferences;

  UpdateEndpointOverride? _override;
  late BundleUpdateConfig _current;

  /// 目前生效的設定；每次使用時重新取，不要快取。
  BundleUpdateConfig get current => _current;

  /// 目前的覆寫值；沒有覆寫時為 null。
  UpdateEndpointOverride? get override => _override;

  /// 先寫入持久化再更新記憶體：寫入失敗就維持原樣，不留下「記憶體已換、重開又退回」的分歧。
  Future<void> setOverride(UpdateEndpointOverride value) async {
    await _preferences?.setString(kUpdateOverridePreferenceKey, jsonEncode(value.toJson()));
    _override = value;
    _current = _compose(value);
  }

  /// 移除覆寫並回到編譯期預設。
  Future<void> clearOverride() async {
    await _preferences?.remove(kUpdateOverridePreferenceKey);
    _override = null;
    _current = _compose(null);
  }

  BundleUpdateConfig _compose(UpdateEndpointOverride? value) {
    return value == null ? defaults : value.applyTo(defaults);
  }

  /// 讀出持久化的覆寫；內容損毀時記錄後退回預設，不讓壞掉的偏好值擋住啟動。
  UpdateEndpointOverride? _load() {
    final raw = _preferences?.getString(kUpdateOverridePreferenceKey);
    if (raw == null) {
      return null;
    }
    try {
      return UpdateEndpointOverride.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    }
    catch (e) {
      debugPrint('[UpdateConfigStore] ignored malformed override: $e');
      return null;
    }
  }
}
