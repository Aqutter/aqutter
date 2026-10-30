import 'dart:convert';

import 'package:cryptography/cryptography.dart';

/// 網頁包簽章的公鑰清單（編譯期 `--dart-define=AQUTTER_UPDATE_PUBLIC_KEYS=…`）。
///
/// 只來自編譯期，網頁無法經 `update_config_set` 之類的 handler 更動它——簽章要防的
/// 正是「更新來源被換掉或被入侵」，公鑰若能被同一個來源改掉就失去意義。
const String _envPublicKeys = String.fromEnvironment('AQUTTER_UPDATE_PUBLIC_KEYS');

/// Ed25519 公鑰的原始長度（位元組）。
const int _publicKeyLength = 32;

/// Ed25519 簽章的長度（位元組）。
const int _signatureLength = 64;

/// 簽章訊息的固定前綴；版本字樣讓日後換格式時舊簽章不會被誤認。
const String bundleSignaturePrefix = 'aqutter-bundle-v1';

/// 簽章訊息：`aqutter-bundle-v1\n{version}\n{sha256 小寫十六進位}\n`（UTF-8）。
///
/// 簽署端（`aqutter bundle sign`）與這裡必須逐位元組相同；版本被簽進去，
/// 攻擊者不能把舊包貼上新的版本號。
List<int> bundleSignatureMessage(String version, String sha256Hex) {
  return utf8.encode('$bundleSignaturePrefix\n$version\n${sha256Hex.toLowerCase()}\n');
}

/// 驗證網頁包的 Ed25519 簽章。
///
/// 公鑰清單內任一把驗證通過即可（金鑰輪替時新舊並存）。清單為空時 [BundleSignatureVerifier.fromEnvironment]
/// 回傳 null，代表不驗簽章、維持原本只看雜湊的行為。
class BundleSignatureVerifier {
  BundleSignatureVerifier(List<List<int>> publicKeys)
      : assert(publicKeys.isNotEmpty),
        _publicKeys = List.unmodifiable(publicKeys);

  /// 解析逗號分隔的標準 Base64 原始公鑰；空白與空項忽略，全空回傳 null。
  ///
  /// 任何一項不是合法 Base64、或解碼後不是 32 位元組就丟出 [ArgumentError]，不靜默忽略：
  /// 打錯一個字元若默默變成「沒有公鑰」，等於悄悄關掉簽章保護。
  static BundleSignatureVerifier? parse(String value) {
    final keys = <List<int>>[];
    for (final raw in value.split(',')) {
      final item = raw.trim();
      if (item.isEmpty) {
        continue;
      }
      final List<int> bytes;
      try {
        bytes = base64.decode(item);
      }
      on FormatException {
        throw ArgumentError.value(item, 'AQUTTER_UPDATE_PUBLIC_KEYS', '不是合法的 Base64');
      }
      if (bytes.length != _publicKeyLength) {
        throw ArgumentError.value(item, 'AQUTTER_UPDATE_PUBLIC_KEYS', '公鑰必須是 $_publicKeyLength 位元組');
      }
      keys.add(bytes);
    }
    return keys.isEmpty ? null : BundleSignatureVerifier(keys);
  }

  /// 由編譯期 env 建構；沒設公鑰回傳 null。值不合法時丟出 [ArgumentError]，由呼叫端接進錯誤畫面。
  static BundleSignatureVerifier? fromEnvironment() => parse(_envPublicKeys);

  final List<List<int>> _publicKeys;

  /// 驗證 [signature] 是對 [version] 與 [sha256Hex] 的有效簽章；任何不符都丟出 [StateError]。
  ///
  /// 訊息只說原因類別，不印簽章或公鑰全文。[sha256Hex] 須是呼叫端對實際下載位元組算出的值，
  /// 不是伺服器宣告的值——兩者是否一致由呼叫端先比。
  Future<void> verify({
    required String version,
    required String sha256Hex,
    required String? signature,
  }) async {
    if (signature == null || signature.trim().isEmpty) {
      throw StateError('Bundle signature missing');
    }
    final List<int> signatureBytes;
    try {
      signatureBytes = base64.decode(signature.trim());
    }
    on FormatException {
      throw StateError('Bundle signature is not valid base64');
    }
    if (signatureBytes.length != _signatureLength) {
      throw StateError('Bundle signature has the wrong length');
    }
    final message = bundleSignatureMessage(version, sha256Hex);
    final algorithm = Ed25519();
    for (final key in _publicKeys) {
      final valid = await algorithm.verify(
        message,
        signature: Signature(signatureBytes, publicKey: SimplePublicKey(key, type: KeyPairType.ed25519)),
      );
      if (valid) {
        return;
      }
    }
    throw StateError('Bundle signature verification failed');
  }
}
