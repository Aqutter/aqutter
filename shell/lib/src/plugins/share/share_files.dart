import 'dart:io';

import 'package:share_plus/share_plus.dart';

import '../_shared/native_features.dart';

/// 交給系統分享面板；測試時以假的取代。
typedef ShareFunction = Future<ShareResult> Function(ShareParams params);

/// 分享檔案（含圖片）：把位元組暫存到 [tempRoot] 下一個獨立資料夾，交給 [share]，結束後盡力刪除。
///
/// 每次分享各用一個資料夾，同名檔案不會互相覆蓋；檔名已由 [ShareRequest.parse] 驗證為單一檔名，
/// 不會寫到暫存目錄之外。系統分享面板可能在使用者選完目的地後才讀檔，所以不能在 [share] 一回來就刪的
/// 平台由系統負責拷貝；刪除失敗不影響結果。
Future<ShareResult> shareFiles(
  ShareRequest request, {
  required Directory tempRoot,
  ShareFunction? share,
}) async {
  final dir = Directory('${tempRoot.path}${Platform.pathSeparator}aqutter_share${Platform.pathSeparator}${DateTime.now().microsecondsSinceEpoch}');
  await dir.create(recursive: true);
  try {
    final files = <XFile>[];
    for (final file in request.files) {
      final path = '${dir.path}${Platform.pathSeparator}${file.name}';
      await File(path).writeAsBytes(file.bytes, flush: true);
      files.add(XFile(path, mimeType: file.mimeType, name: file.name));
    }
    final params = ShareParams(files: files, text: request.textWithUrl, subject: request.subject);
    return await (share ?? SharePlus.instance.share)(params);
  }
  finally {
    try {
      await dir.delete(recursive: true);
    }
    on FileSystemException {
      // 暫存檔留著也無妨，下次系統清暫存時會一併清掉
    }
  }
}
