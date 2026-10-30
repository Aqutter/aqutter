import 'package:aqutter/src/bridge/safe_file_name.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('downloadFileNameProblem', () {
    test('accepts plain file names, including non-ASCII ones', () {
      for (final name in ['report.pdf', 'a', 'photo 1.jpg', '報告.pdf', 'v1.2.3-final_(1).zip', '.hidden']) {
        expect(downloadFileNameProblem(name), isNull, reason: name);
      }
    });

    test('rejects anything that can leave the documents directory', () {
      for (final name in ['../x', '..', '.', 'a/b', 'a\\b', '/etc/passwd', 'C:\\x', 'C:x', '..\\x', 'sub/../x']) {
        expect(downloadFileNameProblem(name), isNotNull, reason: name);
      }
    });

    test('rejects empty, too long, control characters and Windows-reserved characters', () {
      expect(downloadFileNameProblem(''), isNotNull);
      expect(downloadFileNameProblem('a' * 129), isNotNull);
      expect(downloadFileNameProblem('a' * 128), isNull);
      for (final name in ['a\u0000b', 'a\nb', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b']) {
        expect(downloadFileNameProblem(name), isNotNull, reason: name.codeUnits.toString());
      }
    });

    test('rejects names that end with a dot or a space (Windows would rewrite them)', () {
      expect(downloadFileNameProblem('a.'), isNotNull);
      expect(downloadFileNameProblem('a '), isNotNull);
    });

    test('rejects values that are not strings', () {
      expect(downloadFileNameProblem(null), isNotNull);
      expect(downloadFileNameProblem(1), isNotNull);
    });
  });
}
