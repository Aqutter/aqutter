import 'package:flutter_test/flutter_test.dart';
import 'package:aqutter/src/app_ready_mode.dart';

void main() {
  group('requiresAppReady', () {
    test('empty flag without an update URL is not strict', () {
      expect(requiresAppReady(flag: '', updateBaseUrl: ''), isFalse);
      expect(requiresAppReady(flag: '  ', updateBaseUrl: '  '), isFalse);
    });

    test('empty flag with an update URL is strict', () {
      expect(requiresAppReady(flag: '', updateBaseUrl: 'https://cdn.example.com/app'), isTrue);
    });

    test('true is strict even without an update URL', () {
      expect(requiresAppReady(flag: 'true', updateBaseUrl: ''), isTrue);
      expect(requiresAppReady(flag: ' TRUE ', updateBaseUrl: ''), isTrue);
    });

    test('false is not strict even with an update URL', () {
      expect(requiresAppReady(flag: 'false', updateBaseUrl: 'https://cdn.example.com/app'), isFalse);
    });

    test('an unrecognised value fails loudly', () {
      expect(
        () => requiresAppReady(flag: 'yes', updateBaseUrl: ''),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  test('the frame-wait script returns after two animation frames', () {
    expect('requestAnimationFrame'.allMatches(kAfterTwoFramesScript).length, 2);
    expect(kAfterTwoFramesScript, contains('return true;'));
  });
}
