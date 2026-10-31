import 'dart:io';
import 'dart:typed_data';

import 'package:aqutter/src/plugins/clipboard/clipboard_image_service.dart';
import 'package:aqutter/src/plugins/_shared/native_features.dart';
import 'package:aqutter/src/plugins/share/share_files.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:share_plus/share_plus.dart';

/// 最小的合法 PNG 開頭（只檢查簽名）。
final Uint8List _png = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3]);
final Uint8List _jpeg = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 1, 2]);

class _FakeImageSource implements ClipboardImageSource {
  Uint8List? stored;
  ClipboardImageFormat? lastFormat;

  @override
  Future<Uint8List?> readPng() async => stored;

  @override
  Future<void> write(Uint8List bytes, ClipboardImageFormat format) async {
    stored = bytes;
    lastFormat = format;
  }
}

void main() {
  group('ShareRequest with files', () {
    Map<String, dynamic> file(String name, Uint8List data, {String? mimeType}) => {
          'name': name,
          'data': data,
          'mimeType': ?mimeType,
        };

    test('files alone are enough, and the MIME type comes from the extension when not given', () {
      final request = ShareRequest.parse({
        'files': [file('logo.png', _png), file('notes.TXT', Uint8List(1)), file('blob.xyz', Uint8List(1)), file('x.png', _png, mimeType: 'image/x-custom')],
      });

      expect(request.files.map((f) => f.mimeType), ['image/png', 'text/plain', 'application/octet-stream', 'image/x-custom']);
    });

    test('text and url become one text next to the files', () {
      final request = ShareRequest.parse({'text': 'look', 'url': 'https://example.com', 'files': [file('a.png', _png)]});

      expect(request.textWithUrl, 'look\nhttps://example.com');
      expect(ShareRequest.parse({'files': [file('a.png', _png)]}).textWithUrl, isNull);
    });

    test('at most 5 files, each at most 5 MiB, every name a plain file name', () {
      final one = file('a.png', _png);
      expect(() => ShareRequest.parse({'files': [one, one, one, one, one, one]}), throwsA(isA<NativeArgumentException>()));
      expect(ShareRequest.parse({'files': [one, one, one, one, one]}).files, hasLength(5));
      expect(() => ShareRequest.parse({'files': [file('big.bin', Uint8List(maxBinaryBytes + 1))]}), throwsA(isA<NativeArgumentException>()));
      expect(ShareRequest.parse({'files': [file('ok.bin', Uint8List(maxBinaryBytes))]}).files.single.bytes.length, maxBinaryBytes);
      for (final bad in ['../x.png', 'a/b.png', '', '..']) {
        expect(() => ShareRequest.parse({'files': [file(bad, _png)]}), throwsA(isA<NativeArgumentException>()), reason: bad);
      }
    });

    test('data must be bytes, files must be a list of objects', () {
      expect(() => ShareRequest.parse({'files': [{'name': 'a.png', 'data': 'text'}]}), throwsA(isA<NativeArgumentException>()));
      expect(() => ShareRequest.parse({'files': 'nope'}), throwsA(isA<NativeArgumentException>()));
      expect(() => ShareRequest.parse({'files': [1]}), throwsA(isA<NativeArgumentException>()));
    });

    test('nothing to share is still refused', () {
      expect(() => ShareRequest.parse({'files': []}), throwsA(isA<NativeArgumentException>()));
    });
  });

  group('shareFiles', () {
    late Directory root;

    setUp(() async {
      root = await Directory.systemTemp.createTemp('aqutter_share_test');
    });

    tearDown(() async {
      await root.delete(recursive: true);
    });

    test('writes each file next to a private folder, hands them to the sheet, then cleans up', () async {
      late List<String> seen;
      late List<List<int>> contents;
      late String? text;

      final result = await shareFiles(
        ShareRequest.parse({
          'text': 'hi',
          'files': [
            {'name': 'logo.png', 'data': _png},
            {'name': 'a.txt', 'data': Uint8List.fromList([65])},
          ],
        }),
        tempRoot: root,
        share: (params) async {
          seen = params.files!.map((f) => f.name).toList();
          contents = [for (final f in params.files!) File(f.path).readAsBytesSync()];
          text = params.text;
          return const ShareResult('ok', ShareResultStatus.success);
        },
      );

      expect(result.status, ShareResultStatus.success);
      expect(seen, ['logo.png', 'a.txt']);
      expect(contents, [_png, [65]]);
      expect(text, 'hi');
      expect(Directory('${root.path}${Platform.pathSeparator}aqutter_share').listSync(), isEmpty, reason: 'temporary files are removed');
    });

    test('the temporary folder is removed even when the share fails', () async {
      await expectLater(
        shareFiles(
          ShareRequest.parse({'files': [{'name': 'a.png', 'data': _png}]}),
          tempRoot: root,
          share: (_) async => throw StateError('sheet failed'),
        ),
        throwsStateError,
      );

      expect(Directory('${root.path}${Platform.pathSeparator}aqutter_share').listSync(), isEmpty);
    });
  });

  group('ClipboardImageWrite', () {
    test('accepts PNG and JPEG whose bytes match the declared type, defaulting to PNG', () {
      expect(ClipboardImageWrite.parse({'data': _png}).format, ClipboardImageFormat.png);
      expect(ClipboardImageWrite.parse({'data': _png, 'mimeType': 'image/png'}).format, ClipboardImageFormat.png);
      expect(ClipboardImageWrite.parse({'data': _jpeg, 'mimeType': 'image/jpeg'}).format, ClipboardImageFormat.jpeg);
    });

    test('refuses other types, mismatching bytes, oversized or non-byte data', () {
      expect(() => ClipboardImageWrite.parse({'data': _png, 'mimeType': 'image/gif'}), throwsA(isA<NativeArgumentException>()));
      expect(() => ClipboardImageWrite.parse({'data': _jpeg}), throwsA(isA<NativeArgumentException>()), reason: 'JPEG bytes declared as PNG');
      expect(() => ClipboardImageWrite.parse({'data': _png, 'mimeType': 'image/jpeg'}), throwsA(isA<NativeArgumentException>()));
      expect(() => ClipboardImageWrite.parse({'data': Uint8List(maxBinaryBytes + 1)}), throwsA(isA<NativeArgumentException>()));
      expect(() => ClipboardImageWrite.parse({'data': 'abc'}), throwsA(isA<NativeArgumentException>()));
      expect(() => ClipboardImageWrite.parse({}), throwsA(isA<NativeArgumentException>()));
    });
  });

  group('ClipboardImageService', () {
    test('write then read returns the PNG with its MIME type', () async {
      final source = _FakeImageSource();
      final service = ClipboardImageService(source: source);

      expect(await service.write({'data': _png}), {'ok': true});
      final read = await service.read();

      expect(read['image'], {'mimeType': 'image/png', 'data': _png});
    });

    test('an empty clipboard reads as null', () async {
      expect(await ClipboardImageService(source: _FakeImageSource()).read(), {'image': null});
    });

    test('a clipboard image over the limit is refused with too_large, not truncated', () async {
      final source = _FakeImageSource()..stored = Uint8List(maxBinaryBytes + 1);

      await expectLater(
        ClipboardImageService(source: source).read(),
        throwsA(isA<NativeArgumentException>().having((e) => e.code, 'code', nativeTooLarge)),
      );
    });

    test('an invalid write never reaches the platform', () async {
      final source = _FakeImageSource();

      await expectLater(ClipboardImageService(source: source).write({'data': Uint8List(4)}), throwsA(isA<NativeArgumentException>()));
      expect(source.stored, isNull);
    });
  });
}
