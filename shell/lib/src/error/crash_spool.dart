import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

import 'aqutter_error_reporter.dart';

/// 待送錯誤紀錄的持久化佇列：每筆一個 `{id}.json`，網頁確認寫入（ack）後才刪除。
///
/// 跨重啟保留；超過 [maxEntries] 時丟棄最舊的。
class CrashSpool {
  CrashSpool(this.directory, {this.maxEntries = 50});

  final Directory directory;
  final int maxEntries;

  static final RegExp _idPattern = RegExp(r'^\d+-[0-9a-f]{6}$');

  /// [id] 是否為本 spool 產生的格式。ack 來自網頁，刪檔前必須驗證，避免路徑穿越。
  static bool isValidId(String id) => _idPattern.hasMatch(id);

  File _fileOf(String id) => File(p.join(directory.path, '$id.json'));

  /// 寫入一筆（先寫暫存檔再改名，避免寫到一半被殺留下壞檔），並修剪到上限。
  Future<void> add(AqutterErrorReport report) async {
    await directory.create(recursive: true);
    final target = _fileOf(report.id);
    final temp = File('${target.path}.tmp');
    await temp.writeAsString(jsonEncode(report.toJson()), flush: true);
    await temp.rename(target.path);
    await _trim();
  }

  /// 尚未確認的紀錄，依時間由舊到新；壞檔直接刪除。
  Future<List<AqutterErrorReport>> pending() async {
    if (!await directory.exists()) {
      return const [];
    }
    final reports = <AqutterErrorReport>[];
    await for (final entity in directory.list()) {
      if (entity is! File || !entity.path.endsWith('.json')) {
        continue;
      }
      try {
        final json = jsonDecode(await entity.readAsString()) as Map<String, dynamic>;
        reports.add(AqutterErrorReport.fromJson(json));
      } on Object {
        await _deleteQuietly(entity);
      }
    }
    reports.sort((a, b) => a.time.compareTo(b.time));
    return reports;
  }

  /// 刪除已確認的紀錄；未知或格式不合的 id 忽略。
  Future<void> ack(Iterable<String> ids) async {
    for (final id in ids) {
      if (isValidId(id)) {
        await _deleteQuietly(_fileOf(id));
      }
    }
  }

  Future<void> _trim() async {
    final all = await pending();
    if (all.length <= maxEntries) {
      return;
    }
    for (final stale in all.take(all.length - maxEntries)) {
      await _deleteQuietly(_fileOf(stale.id));
    }
  }

  Future<void> _deleteQuietly(File file) async {
    try {
      if (await file.exists()) {
        await file.delete();
      }
    } on FileSystemException {
      // 刪不掉就留著，下次再處理。
    }
  }
}
