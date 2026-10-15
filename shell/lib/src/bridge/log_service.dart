import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// 應用日誌檔管理：動態檔名（跨午夜換檔）、追加、列表 / 讀取 / 寫入 / 刪除。
///
/// 對接前端 useAppLog（append / setKey）與 useAppLogger（list / read / write / remove / dir）。
class LogService {
  String _logKey = 'app';

  Directory? _cachedDir;

  Future<Directory> _logDir() async {
    final cached = _cachedDir;
    if (cached != null) {
      return cached;
    }
    final support = await getApplicationSupportDirectory();
    final dir = Directory(p.join(support.path, 'logs'));
    await dir.create(recursive: true);
    _cachedDir = dir;
    return dir;
  }

  String _dateSegment(DateTime now) {
    final yyyy = now.year.toString().padLeft(4, '0');
    final mm = now.month.toString().padLeft(2, '0');
    final dd = now.day.toString().padLeft(2, '0');
    return '$yyyy$mm$dd';
  }

  Future<File> _currentFile() async {
    final dir = await _logDir();
    final name = '${_logKey}_${_dateSegment(DateTime.now())}.log';
    return File(p.join(dir.path, name));
  }

  /// 設定 log 檔名 key；下一筆 append 起寫入新檔。
  void setKey(String key) {
    _logKey = key;
  }

  /// 追加一行（含時間戳與層級）到當前 log 檔。
  Future<void> append(String level, String message) async {
    final file = await _currentFile();
    final line = '${DateTime.now().toIso8601String()} [$level] $message\n';
    await file.writeAsString(line, mode: FileMode.append, flush: true);
  }

  /// 列出 log 目錄下所有檔案資訊。
  Future<List<Map<String, dynamic>>> list() async {
    final dir = await _logDir();
    final result = <Map<String, dynamic>>[];
    await for (final entity in dir.list()) {
      if (entity is! File) {
        continue;
      }
      final name = p.basename(entity.path);
      final stat = await entity.stat();
      result.add({
        'name': name,
        'path': name,
        'size': stat.size,
        'mtime': stat.modified.millisecondsSinceEpoch,
      });
    }
    return result;
  }

  /// 讀取指定 log 檔文字內容。
  Future<String> read(String name) async {
    final dir = await _logDir();
    return File(p.join(dir.path, name)).readAsString();
  }

  /// 寫入 base64 位元組到 log 目錄下指定檔名（zip 備份用）。
  Future<void> write(String name, String bytesBase64) async {
    final dir = await _logDir();
    await File(p.join(dir.path, name)).writeAsBytes(base64Decode(bytesBase64));
  }

  /// 刪除 log 目錄下指定檔案。
  Future<void> remove(String name) async {
    final dir = await _logDir();
    final file = File(p.join(dir.path, name));
    if (await file.exists()) {
      await file.delete();
    }
  }

  /// 取得 log 目錄絕對路徑。
  Future<String> dirPath() async {
    return (await _logDir()).path;
  }
}
