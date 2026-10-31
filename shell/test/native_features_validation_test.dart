import 'package:aqutter/src/plugins/_shared/native_features.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime.utc(2026, 10, 30, 12);

  group('parseClipboardText', () {
    test('accepts text, including the empty string used to clear the clipboard', () {
      expect(parseClipboardText({'text': 'hello'}), 'hello');
      expect(parseClipboardText({'text': ''}), '');
    });

    test('rejects a missing or non-string text and anything over the limit', () {
      expect(() => parseClipboardText({}), throwsA(isA<NativeArgumentException>()));
      expect(() => parseClipboardText({'text': 1}), throwsA(isA<NativeArgumentException>()));
      expect(parseClipboardText({'text': 'a' * maxClipboardLength}).length, maxClipboardLength);
      expect(() => parseClipboardText({'text': 'a' * (maxClipboardLength + 1)}), throwsA(isA<NativeArgumentException>()));
    });
  });

  group('ShareRequest', () {
    test('needs at least one non-empty text or url', () {
      expect(() => ShareRequest.parse({}), throwsA(isA<NativeArgumentException>()));
      expect(() => ShareRequest.parse({'text': '', 'url': ''}), throwsA(isA<NativeArgumentException>()));
      expect(ShareRequest.parse({'text': 'hi'}).combinedText, 'hi');
      expect(ShareRequest.parse({'url': 'https://example.com'}).combinedText, isNull);
    });

    test('text and url together become one text', () {
      expect(ShareRequest.parse({'text': 'look', 'url': 'https://example.com'}).combinedText, 'look\nhttps://example.com');
    });

    test('enforces the per-field limit', () {
      expect(() => ShareRequest.parse({'text': 'a' * (maxShareLength + 1)}), throwsA(isA<NativeArgumentException>()));
      expect(() => ShareRequest.parse({'text': 'a', 'subject': 'b' * (maxShareLength + 1)}), throwsA(isA<NativeArgumentException>()));
    });
  });

  group('NotificationRequest', () {
    NotificationRequest parse(Map<String, dynamic> payload, {bool scheduled = false}) {
      return NotificationRequest.parse(payload, scheduled: scheduled, now: now);
    }

    test('a title is required and may not be empty or too long', () {
      expect(() => parse({}), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': ''}), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 'a' * (maxTitleLength + 1)}), throwsA(isA<NativeArgumentException>()));
      final request = parse({'title': 't'});
      expect(request.body, '');
      expect(request.id, isNull);
      expect(request.payload, isNull);
      expect(request.at, isNull);
    });

    test('body and payload are optional with their own limits', () {
      expect(parse({'title': 't', 'body': 'b', 'payload': 'p'}).payload, 'p');
      expect(() => parse({'title': 't', 'body': 'b' * (maxBodyLength + 1)}), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 't', 'payload': 'p' * (maxPayloadLength + 1)}), throwsA(isA<NativeArgumentException>()));
    });

    test('id must be a 32-bit integer', () {
      expect(parse({'title': 't', 'id': 7}).id, 7);
      expect(parse({'title': 't', 'id': -2147483648}).id, -2147483648);
      expect(() => parse({'title': 't', 'id': 2147483648}), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 't', 'id': '7'}), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 't', 'id': 1.5}), throwsA(isA<NativeArgumentException>()));
    });

    test('a scheduled notification needs atMs in the future', () {
      final future = now.add(const Duration(minutes: 5)).millisecondsSinceEpoch;
      final request = parse({'title': 't', 'atMs': future}, scheduled: true);
      expect(request.at, DateTime.fromMillisecondsSinceEpoch(future, isUtc: true));
      expect(() => parse({'title': 't'}, scheduled: true), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 't', 'atMs': now.millisecondsSinceEpoch}, scheduled: true), throwsA(isA<NativeArgumentException>()));
      expect(() => parse({'title': 't', 'atMs': 'soon'}, scheduled: true), throwsA(isA<NativeArgumentException>()));
    });

    test('an immediate notification ignores atMs', () {
      expect(parse({'title': 't', 'atMs': 1}).at, isNull);
    });
  });

  test('parseCancelId: absent means all, otherwise a 32-bit integer', () {
    expect(parseCancelId({}), isNull);
    expect(parseCancelId({'id': 3}), 3);
    expect(() => parseCancelId({'id': 'x'}), throwsA(isA<NativeArgumentException>()));
  });

  test('errors carry the contract codes and become aqutterError payloads', () {
    const error = NativeArgumentException('bad');
    expect(error.code, 'invalid_argument');
    expect(error.toPayload(), {
      'aqutterError': {'code': 'invalid_argument', 'message': 'bad'},
    });
    expect(const NativeArgumentException('x', code: nativePermissionDenied).code, 'permission_denied');
  });
}
