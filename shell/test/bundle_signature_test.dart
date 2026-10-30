import 'dart:convert';

import 'package:aqutter/src/server/bundle_manager.dart';
import 'package:aqutter/src/server/bundle_signature.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';

/// 契約 §6 的共同測試向量（RFC 8032 測試金鑰，僅供測試）。
const String _publicKey = '11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=';
const String _version = '260911063945';
const String _sha256 = '80505ff7171bc749a81d3c62a17b89106e7aca380f7b7b5fc75069d206bb566c';
const String _signature = '/nPo51OalWZkw9YlTkVVaUUDcY2hPhzVsdVzmelCPgDTcf6DbjAnc6IGAziJkIFjoSY+fOXx88vOxuJX7vkABg==';

/// 代表「別人的金鑰」：只要是合法的 32 位元組公鑰，就不會驗過上面那組簽章。
final String _otherPublicKey = base64.encode(List<int>.filled(32, 7));

RemoteVersion _remote({String version = _version, String? sha256Hex = _sha256, String? signature = _signature}) {
  return RemoteVersion(version: version, url: 'https://example.com/b.zip', sha256: sha256Hex, signature: signature);
}

void main() {
  final bytes = utf8.encode('aqutter-test-bundle');
  final verifier = BundleSignatureVerifier.parse(_publicKey)!;

  test('the shared vector hashes to the documented sha256', () {
    expect(sha256.convert(bytes).toString(), _sha256);
  });

  group('BundleSignatureVerifier.verify', () {
    test('accepts the contract vector', () async {
      await verifier.verify(version: _version, sha256Hex: _sha256, signature: _signature);
    });

    test('accepts an upper-case sha256 (the message always uses lower case)', () async {
      await verifier.verify(version: _version, sha256Hex: _sha256.toUpperCase(), signature: _signature);
    });

    test('rejects a changed version or a changed hash', () async {
      await expectLater(verifier.verify(version: '260911063946', sha256Hex: _sha256, signature: _signature), throwsStateError);
      final tampered = '0${_sha256.substring(1)}';
      await expectLater(verifier.verify(version: _version, sha256Hex: tampered, signature: _signature), throwsStateError);
    });

    test('rejects missing, malformed and wrong-length signatures', () async {
      await expectLater(verifier.verify(version: _version, sha256Hex: _sha256, signature: null), throwsStateError);
      await expectLater(verifier.verify(version: _version, sha256Hex: _sha256, signature: ''), throwsStateError);
      await expectLater(verifier.verify(version: _version, sha256Hex: _sha256, signature: '***not base64***'), throwsStateError);
      await expectLater(verifier.verify(version: _version, sha256Hex: _sha256, signature: base64.encode([1, 2, 3])), throwsStateError);
    });

    test('rejects a signature made by another key', () async {
      final other = BundleSignatureVerifier.parse(_otherPublicKey)!;
      await expectLater(other.verify(version: _version, sha256Hex: _sha256, signature: _signature), throwsStateError);
    });

    test('with several keys any one of them is enough (key rotation)', () async {
      final rotating = BundleSignatureVerifier.parse('$_otherPublicKey, $_publicKey')!;
      await rotating.verify(version: _version, sha256Hex: _sha256, signature: _signature);
    });

    test('the error message never contains the signature itself', () async {
      try {
        await verifier.verify(version: '1', sha256Hex: _sha256, signature: _signature);
        fail('should have thrown');
      }
      on StateError catch (error) {
        expect(error.message, isNot(contains(_signature)));
      }
    });
  });

  group('BundleSignatureVerifier.parse', () {
    test('an empty value means no signature checking', () {
      expect(BundleSignatureVerifier.parse(''), isNull);
      expect(BundleSignatureVerifier.parse('  , ,'), isNull);
    });

    test('rejects values that are not valid keys instead of ignoring them', () {
      expect(() => BundleSignatureVerifier.parse('not base64!'), throwsArgumentError);
      expect(() => BundleSignatureVerifier.parse(base64.encode([1, 2, 3])), throwsArgumentError);
      expect(() => BundleSignatureVerifier.parse('$_publicKey,oops'), throwsArgumentError);
    });
  });

  group('verifyBundleBytes', () {
    test('without a public key behaves as before: hash checked when present, nothing required', () async {
      await verifyBundleBytes(bytes, _remote(signature: null), verifier: null);
      await verifyBundleBytes(bytes, _remote(sha256Hex: null, signature: null), verifier: null);
      await expectLater(
        verifyBundleBytes(utf8.encode('other'), _remote(signature: null), verifier: null),
        throwsStateError,
      );
    });

    test('with a public key a correct hash and signature pass', () async {
      await verifyBundleBytes(bytes, _remote(), verifier: verifier);
    });

    test('with a public key a missing hash or signature is refused', () async {
      await expectLater(verifyBundleBytes(bytes, _remote(sha256Hex: null), verifier: verifier), throwsStateError);
      await expectLater(verifyBundleBytes(bytes, _remote(signature: null), verifier: verifier), throwsStateError);
    });

    test('with a public key different bytes are refused even if the claimed hash is signed', () async {
      await expectLater(verifyBundleBytes(utf8.encode('swapped'), _remote(), verifier: verifier), throwsStateError);
    });

    test('with a public key a valid signature cannot be replayed under a newer version', () async {
      await expectLater(verifyBundleBytes(bytes, _remote(version: '260911063999'), verifier: verifier), throwsStateError);
    });
  });
}
