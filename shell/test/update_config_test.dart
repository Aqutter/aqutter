import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/server/update_config.dart';

/// `fromEnvironment` 讀的是編譯期常數，測試無從注入，故一律測具名建構子的衍生
/// 邏輯——URL 組裝與 header 衍生正是最容易寫錯、又最難從 UI 察覺的部分。
void main() {
  group('versionUri', () {
    test('base 與 path 皆無多餘斜線時直接相接', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com/app');
      expect(config.versionUri.toString(), 'https://example.com/app/version.json');
    });

    test('base 尾斜線與 path 首斜線不會拼出 //', () {
      const config = BundleUpdateConfig(
        baseUrl: 'https://example.com/app/',
        versionPath: '/v1/check-update',
      );
      expect(config.versionUri.toString(), 'https://example.com/app/v1/check-update');
    });

    test('端點路徑可帶 query', () {
      const config = BundleUpdateConfig(
        baseUrl: 'https://example.com',
        versionPath: 'check?channel=beta',
      );
      expect(config.versionUri.toString(), 'https://example.com/check?channel=beta');
    });
  });

  group('enabled', () {
    test('baseUrl 為空即停用', () {
      const config = BundleUpdateConfig(baseUrl: '');
      expect(config.enabled, isFalse);
    });

    test('baseUrl 非空即啟用', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com');
      expect(config.enabled, isTrue);
    });
  });

  group('requireVersionCheck', () {
    test('預設關閉', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com');
      expect(config.requireVersionCheck, isFalse);
      expect(config.assertConsistent, returnsNormally);
    });

    test('開啟且有更新來源即一致', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com', requireVersionCheck: true);
      expect(config.assertConsistent, returnsNormally);
    });

    test('開啟但 baseUrl 為空是矛盾配置，拋 ArgumentError', () {
      const config = BundleUpdateConfig(baseUrl: '', requireVersionCheck: true);
      expect(config.assertConsistent, throwsArgumentError);
    });

    test('parseFlag 留空即預設 false', () {
      expect(BundleUpdateConfig.parseFlag('', key: 'AQUTTER_UPDATE_REQUIRED', defaultValue: false), isFalse);
      expect(BundleUpdateConfig.parseFlag('true', key: 'AQUTTER_UPDATE_REQUIRED', defaultValue: false), isTrue);
    });
  });

  group('authHeaders', () {
    test('未設 apiKey 時為空 map', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com');
      expect(config.authHeaders, isEmpty);
    });

    test('預設 header 名為 X-Api-Key', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com', apiKey: 'secret');
      expect(config.authHeaders, {'X-Api-Key': 'secret'});
    });

    test('header 名可改為 Authorization 以承載 Bearer', () {
      const config = BundleUpdateConfig(
        baseUrl: 'https://example.com',
        apiKey: 'Bearer token',
        apiKeyHeader: 'Authorization',
      );
      expect(config.authHeaders, {'Authorization': 'Bearer token'});
    });
  });

  group('預設值', () {
    test('對齊可配置化之前的行為：GET、version.json、下載帶鑑權', () {
      const config = BundleUpdateConfig(baseUrl: 'https://example.com');
      expect(config.method, UpdateHttpMethod.get);
      expect(config.versionPath, kDefaultVersionPath);
      expect(config.apiKeyHeader, kDefaultApiKeyHeader);
      expect(config.authorizeBundleDownload, isTrue);
    });
  });

  group('UpdateHttpMethod.parse', () {
    test('wireName 為 Dio Options 可直接使用的字面值', () {
      expect(UpdateHttpMethod.get.wireName, 'GET');
      expect(UpdateHttpMethod.post.wireName, 'POST');
    });

    test('留白視為未設定，落到 GET', () {
      expect(UpdateHttpMethod.parse(''), UpdateHttpMethod.get);
      expect(UpdateHttpMethod.parse('   '), UpdateHttpMethod.get);
    });

    test('大小寫不敏感', () {
      expect(UpdateHttpMethod.parse('post'), UpdateHttpMethod.post);
      expect(UpdateHttpMethod.parse(' Get '), UpdateHttpMethod.get);
    });

    test('無法辨識的值直接拋錯，不靜默退回 GET', () {
      expect(() => UpdateHttpMethod.parse('PUT'), throwsArgumentError);
      expect(() => UpdateHttpMethod.parse('gett'), throwsArgumentError);
    });
  });

  group('BundleUpdateConfig.parseFlag', () {
    test('留白落到預設值', () {
      expect(BundleUpdateConfig.parseFlag('', key: 'K', defaultValue: true), isTrue);
      expect(BundleUpdateConfig.parseFlag('  ', key: 'K', defaultValue: false), isFalse);
    });

    test('大小寫不敏感地解析 true / false', () {
      expect(BundleUpdateConfig.parseFlag('TRUE', key: 'K', defaultValue: false), isTrue);
      expect(BundleUpdateConfig.parseFlag(' False ', key: 'K', defaultValue: true), isFalse);
    });

    test('無法辨識的值直接拋錯', () {
      expect(
        () => BundleUpdateConfig.parseFlag('yes', key: 'K', defaultValue: true),
        throwsArgumentError,
      );
    });
  });

  group('UpdateEndpointOverride', () {
    const base = BundleUpdateConfig(
      baseUrl: 'https://default.example.com',
      versionPath: 'v1/check',
      method: UpdateHttpMethod.post,
      apiKey: 'compile-time-key',
      apiKeyHeader: 'Authorization',
      authorizeBundleDownload: false,
      requireVersionCheck: true,
    );

    test('只給 baseUrl：其餘沿用預設，但 API KEY 不沿用', () {
      final config = UpdateEndpointOverride.fromJson({'baseUrl': 'https://other.example.com'}).applyTo(base);
      expect(config.baseUrl, 'https://other.example.com');
      expect(config.versionPath, 'v1/check');
      expect(config.method, UpdateHttpMethod.post);
      expect(config.apiKeyHeader, 'Authorization');
      expect(config.apiKey, isEmpty);
    });

    test('各欄位皆可覆寫', () {
      final config = UpdateEndpointOverride.fromJson({
        'baseUrl': 'https://other.example.com/',
        'versionPath': 'check',
        'method': 'get',
        'apiKey': 'k',
        'apiKeyHeader': 'X-Key',
      }).applyTo(base);
      expect(config.versionUri.toString(), 'https://other.example.com/check');
      expect(config.method, UpdateHttpMethod.get);
      expect(config.authHeaders, {'X-Key': 'k'});
    });

    test('啟動閘與 bundle 鑑權旗標維持編譯期的值', () {
      final config = UpdateEndpointOverride.fromJson({'baseUrl': 'https://other.example.com'}).applyTo(base);
      expect(config.requireVersionCheck, isTrue);
      expect(config.authorizeBundleDownload, isFalse);
    });

    test('baseUrl 缺席、留白、非 http(s) 或無 host 皆拋 ArgumentError', () {
      for (final raw in <Object?>[null, '', '  ', 'ftp://example.com', 'example.com', 'https://']) {
        expect(
          () => UpdateEndpointOverride.fromJson({'baseUrl': raw}),
          throwsArgumentError,
          reason: 'baseUrl=$raw',
        );
      }
    });

    test('method 無法辨識、欄位型別錯誤皆拋 ArgumentError', () {
      expect(
        () => UpdateEndpointOverride.fromJson({'baseUrl': 'https://a.example.com', 'method': 'Put'}),
        throwsArgumentError,
      );
      expect(
        () => UpdateEndpointOverride.fromJson({'baseUrl': 'https://a.example.com', 'apiKey': 123}),
        throwsArgumentError,
      );
    });

    test('toJson 與 fromJson 可往返', () {
      const original = UpdateEndpointOverride(
        baseUrl: 'https://a.example.com',
        versionPath: 'p',
        method: UpdateHttpMethod.post,
        apiKey: 'k',
        apiKeyHeader: 'H',
      );
      final restored = UpdateEndpointOverride.fromJson(original.toJson());
      expect(restored.toJson(), original.toJson());
    });
  });
}
