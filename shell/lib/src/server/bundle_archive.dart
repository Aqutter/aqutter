/// 網頁包（zip）的共用存取：版本解析、解壓、原子換名。
///
/// 遠端熱更新（`BundleManager`）與內建種子（`SeedBootstrapper`）走的是同一套
/// 檔案格式與換上流程，故收攏於此，避免同一份邏輯在兩處各自演化。
library;

import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:path/path.dart' as p;

/// 網頁包根目錄的版本檔名；遠端 `version.json` 契約亦用此名（見 docs/hot-update.md）。
const String kBundleVersionFile = 'version.json';

/// 讀取 [dir] 下 `version.json` 的 `version`。
///
/// 檔案缺席（本次改版前解壓的種子）或內容毀損時回傳 null，由呼叫端決定如何保守處理。
Future<String?> readBundleVersion(Directory dir) async {
  final file = File(p.join(dir.path, kBundleVersionFile));
  if (!await file.exists()) {
    return null;
  }
  try {
    final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
    return json['version'] as String?;
  }
  catch (_) {
    // 版本檔毀損視為無版本，交由更新流程覆蓋
    return null;
  }
}

/// 目錄是否存在且有內容。
Future<bool> hasBundleContent(Directory dir) async {
  if (!await dir.exists()) {
    return false;
  }
  return !(await dir.list().isEmpty);
}

/// 解包進度回呼：[done] / [total] 為已寫出與總計的項目數。
typedef BundleExtractProgress = void Function(int done, int total);

/// 把 [zipBytes] 解壓進 [target]；[target] 既有內容會先整個清掉。
///
/// 刻意不做增量覆蓋：舊版的 hashed chunk 不會出現在新包的檔名清單中，
/// 逐檔覆寫會讓它們永遠殘留並逐次累積。
///
/// [onProgress] 逐項回報。**回呼很密集**（大包有數百項），節流是呼叫端的責任——
/// 這裡不代為節流，否則呼叫端就失去了「要不要更新畫面」的決定權。
Future<void> extractBundle(
  Directory target,
  List<int> zipBytes, {
  BundleExtractProgress? onProgress,
}) async {
  if (await target.exists()) {
    await target.delete(recursive: true);
  }
  await target.create(recursive: true);

  final archive = ZipDecoder().decodeBytes(zipBytes);
  final total = archive.length;
  var done = 0;
  for (final entry in archive) {
    final outPath = p.join(target.path, entry.name);
    if (entry.isFile) {
      final outFile = File(outPath);
      await outFile.create(recursive: true);
      await outFile.writeAsBytes(entry.content as List<int>);
    }
    else {
      await Directory(outPath).create(recursive: true);
    }
    done++;
    onProgress?.call(done, total);
  }
}

/// 原子換名：把已驗證的 [staging] 換上 [current]。
///
/// 解壓與換上刻意分成兩步——若直接解壓進 [current]，中途失敗會留下半套內容且
/// 舊版已被清掉，App 將無可服務的網頁包。先解到暫存區才能保住 rollback。
///
/// 給定 [previous] 時，舊的 [current] 不刪除而是換名保留過去，供「網頁包能載入
/// 但起不來」時回滾。**這是下載成功之後唯一的退路**：換上之後遠端內容已成為
/// `current/`，若不留一份，能退的就只剩出廠種子。上一份 [previous] 會被覆蓋，
/// 故保留深度恆為一版——再多也沒有意義，回滾兩次代表問題不在網頁包。
Future<void> commitBundle(
  Directory staging,
  Directory current, {
  Directory? previous,
}) async {
  if (!await current.exists()) {
    await staging.rename(current.path);
    return;
  }

  if (previous == null) {
    await current.delete(recursive: true);
    await staging.rename(current.path);
    return;
  }

  if (await previous.exists()) {
    await previous.delete(recursive: true);
  }
  await current.rename(previous.path);
  await staging.rename(current.path);
}

/// 把 [previous] 換回 [current]，回傳是否真的回滾了。
///
/// 沒有 [previous] 時回傳 false 而不擲例外：呼叫端此時多半正在處理另一個失敗，
/// 「沒有可退的版本」是需要分支處理的正常結果，不是意外。
///
/// 回滾後 [previous] 即消失，因此不會連續回滾兩次——第二次失敗會落到呼叫端的
/// 「無可退版本」分支，由它決定要顯示什麼。
Future<bool> rollbackBundle(Directory current, Directory previous) async {
  if (!await previous.exists()) {
    return false;
  }
  if (await current.exists()) {
    await current.delete(recursive: true);
  }
  await previous.rename(current.path);
  return true;
}
