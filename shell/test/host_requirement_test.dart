import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/server/host_requirement.dart';
import 'package:aqutter/src/server/host_version.dart';

/// 版本回應 `host` 區塊的合併與比對——契約最容易寫錯的地方是平台覆寫的優先序，
/// 以及「無法比對」與「最舊」的區分。
void main() {
  const host = HostVersion(name: '1.0.0', buildNumber: 3, buildNumberRaw: '3');

  group('fromJson', () {
    test('頂層欄位為全平台預設', () {
      final req = HostRequirement.fromJson({
        'minBuildNumber': 5,
        'updateUrl': 'https://example.com/store',
      }, platform: 'ios');
      expect(req.minBuildNumber, 5);
      expect(req.updateUrl, 'https://example.com/store');
      expect(req.updateType, HostUpdateType.external);
    });

    test('平台子物件逐欄覆寫，未覆寫的欄位沿用預設', () {
      final req = HostRequirement.fromJson({
        'minBuildNumber': 5,
        'updateUrl': 'https://example.com/store',
        'android': {
          'updateUrl': 'https://example.com/app.apk',
          'updateType': 'apk',
          'updateSha256': 'ABC',
        },
      }, platform: 'android');
      expect(req.minBuildNumber, 5);
      expect(req.updateUrl, 'https://example.com/app.apk');
      expect(req.updateType, HostUpdateType.apk);
      expect(req.updateSha256, 'ABC');
    });

    test('updateSize 收整數或數字字串，缺席為 null', () {
      expect(HostRequirement.fromJson({'updateSize': 1234}, platform: 'android').updateSize, 1234);
      expect(HostRequirement.fromJson({'updateSize': '5678'}, platform: 'android').updateSize, 5678);
      expect(HostRequirement.fromJson({}, platform: 'android').updateSize, isNull);
    });

    test('其他平台的子物件不影響本平台', () {
      final req = HostRequirement.fromJson({
        'minBuildNumber': 5,
        'android': {'minBuildNumber': 9},
      }, platform: 'ios');
      expect(req.minBuildNumber, 5);
    });

    test('minBuildNumber 可為數字字串', () {
      final req = HostRequirement.fromJson({'minBuildNumber': '7'}, platform: 'android');
      expect(req.minBuildNumber, 7);
    });

    test('無法辨識的 updateType 拋錯而非退回 external', () {
      expect(
        () => HostRequirement.fromJson({'updateType': 'msi'}, platform: 'windows'),
        throwsFormatException,
      );
    });
  });

  group('blocks', () {
    test('本機低於要求即阻擋', () {
      expect(const HostRequirement(minBuildNumber: 4).blocks(host), isTrue);
    });

    test('相等或高於要求不阻擋', () {
      expect(const HostRequirement(minBuildNumber: 3).blocks(host), isFalse);
      expect(const HostRequirement(minBuildNumber: 2).blocks(host), isFalse);
    });

    test('未宣告 minBuildNumber 不阻擋', () {
      expect(const HostRequirement().blocks(host), isFalse);
    });

    test('本機 build number 非整數時視為無法比對，不阻擋', () {
      const odd = HostVersion(name: '1.0.0', buildNumber: null, buildNumberRaw: '1.0.0.7');
      expect(const HostRequirement(minBuildNumber: 999).blocks(odd), isFalse);
    });
  });
}
