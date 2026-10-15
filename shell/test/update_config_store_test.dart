import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/server/update_config.dart';
import 'package:aqutter/src/server/update_config_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _defaults = BundleUpdateConfig(baseUrl: 'https://default.example.com', apiKey: 'compile-time-key');
const _other = UpdateEndpointOverride(baseUrl: 'https://other.example.com', apiKey: 'other-key');

Future<SharedPreferences> _prefs([Map<String, Object> initial = const {}]) async {
  SharedPreferences.setMockInitialValues(initial);
  return SharedPreferences.getInstance();
}

void main() {
  test('沒有覆寫時 current 就是編譯期預設', () async {
    final store = UpdateConfigStore(defaults: _defaults, preferences: await _prefs());
    expect(store.current, same(_defaults));
    expect(store.override, isNull);
  });

  test('setOverride 立即生效並寫入偏好', () async {
    final prefs = await _prefs();
    final store = UpdateConfigStore(defaults: _defaults, preferences: prefs);
    await store.setOverride(_other);
    expect(store.current.baseUrl, 'https://other.example.com');
    expect(store.current.apiKey, 'other-key');
    expect(prefs.getString(kUpdateOverridePreferenceKey), isNotNull);
  });

  test('冷啟（以同一份偏好重建 store）沿用覆寫', () async {
    final prefs = await _prefs();
    await UpdateConfigStore(defaults: _defaults, preferences: prefs).setOverride(_other);
    final restarted = UpdateConfigStore(defaults: _defaults, preferences: prefs);
    expect(restarted.current.baseUrl, 'https://other.example.com');
    expect(restarted.override, isNotNull);
  });

  test('clearOverride 回到預設並移除偏好', () async {
    final prefs = await _prefs();
    final store = UpdateConfigStore(defaults: _defaults, preferences: prefs);
    await store.setOverride(_other);
    await store.clearOverride();
    expect(store.current, same(_defaults));
    expect(prefs.getString(kUpdateOverridePreferenceKey), isNull);
  });

  test('覆寫不帶 apiKey 時，編譯期 KEY 不會被帶去新伺服器', () async {
    final store = UpdateConfigStore(defaults: _defaults, preferences: await _prefs());
    await store.setOverride(const UpdateEndpointOverride(baseUrl: 'https://other.example.com'));
    expect(store.current.authHeaders, isEmpty);
  });

  test('偏好內容損毀時退回預設，不擋啟動', () async {
    final prefs = await _prefs({kUpdateOverridePreferenceKey: '{not json'});
    final store = UpdateConfigStore(defaults: _defaults, preferences: prefs);
    expect(store.current, same(_defaults));
  });

  test('偏好內的覆寫驗證不過（例如被改成非 http）時退回預設', () async {
    final prefs = await _prefs({kUpdateOverridePreferenceKey: '{"baseUrl":"ftp://x"}'});
    final store = UpdateConfigStore(defaults: _defaults, preferences: prefs);
    expect(store.current, same(_defaults));
  });

  test('不傳 preferences 時只存在記憶體', () async {
    final store = UpdateConfigStore(defaults: _defaults);
    await store.setOverride(_other);
    expect(store.current.baseUrl, 'https://other.example.com');
  });
}
