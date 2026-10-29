import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'log_retention.dart';

/// log 檔根目錄來源；名稱與 aqutter-js 的 `LogProvider` 值成對。
enum LogProvider {
  /// `getApplicationSupportDirectory`（預設）。
  internal,

  /// `getApplicationDocumentsDirectory`。
  documents,

  /// `getApplicationCacheDirectory`。
  cache,

  /// `getTemporaryDirectory`。
  temp,

  /// `getExternalStorageDirectory`（僅 Android 的 App 專屬外部目錄）。
  external,
}

/// log 寫入目標驗證 / 解析失敗；[toString] 以錯誤代碼開頭，供 JS 端辨識。
class LogTargetException implements Exception {
  const LogTargetException(this.code, this.message);

  /// `log_invalid_target` 或 `log_provider_unavailable`。
  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// 寫入目標：實際檔案為 `{provider 根目錄}/{dir}/{name}_{yyyyMMdd}.log`（與 aqutter-js 的 `LogTarget` 成對）。
class LogTarget {
  const LogTarget({this.provider = LogProvider.internal, this.dir = 'logs', this.name});

  /// 由 bridge 酬載的 `target` 物件建立；欄位型別或 provider 名稱不合法即丟出 [LogTargetException]。
  factory LogTarget.fromJson(Object? json) {
    if (json is! Map) {
      throw const LogTargetException('log_invalid_target', 'target 必須是物件');
    }
    final provider = json['provider'];
    final dir = json['dir'];
    final name = json['name'];
    if ((dir != null && dir is! String) || (name != null && name is! String)) {
      throw const LogTargetException('log_invalid_target', 'dir / name 必須是字串');
    }
    return LogTarget(
      provider: provider == null ? LogProvider.internal : _parseProvider(provider),
      dir: (dir as String?) ?? 'logs',
      name: name as String?,
    );
  }

  final LogProvider provider;
  final String dir;

  /// 省略時使用目前的 log key。
  final String? name;

  static LogProvider _parseProvider(Object provider) {
    for (final value in LogProvider.values) {
      if (value.name == provider) {
        return value;
      }
    }
    throw LogTargetException('log_invalid_target', '未知的 provider: $provider');
  }
}

final RegExp _dirSegmentPattern = RegExp(r'^[A-Za-z0-9._-]+$');
final RegExp _fileNamePattern = RegExp(r'^[A-Za-z0-9._-]{1,64}$');
const int _maxDirSegments = 8;
const int _maxDirLength = 128;

/// 驗證 [dir] 並回傳分段；僅允許相對、安全字元的路徑（不得含 `.` / `..` 段、空段或絕對路徑）。
List<String> validateLogDir(String dir) {
  if (dir.isEmpty || dir.length > _maxDirLength) {
    throw const LogTargetException('log_invalid_target', 'dir 不得為空且長度 ≤ $_maxDirLength');
  }
  final segments = dir.split('/');
  if (segments.length > _maxDirSegments) {
    throw const LogTargetException('log_invalid_target', 'dir 最多 $_maxDirSegments 段');
  }
  for (final segment in segments) {
    if (segment == '.' || segment == '..' || !_dirSegmentPattern.hasMatch(segment)) {
      throw LogTargetException('log_invalid_target', 'dir 含不合法的段: "$segment"');
    }
  }
  return segments;
}

/// 驗證檔名 key。
void validateLogName(String name) {
  if (!_fileNamePattern.hasMatch(name)) {
    throw LogTargetException('log_invalid_target', 'name 不合法: "$name"');
  }
}

/// 解析 provider 的根目錄；本平台不支援時回傳 null。
typedef LogRootResolver = Future<Directory?> Function(LogProvider provider);

Future<Directory?> _defaultRootResolver(LogProvider provider) async {
  try {
    return switch (provider) {
      LogProvider.internal => await getApplicationSupportDirectory(),
      LogProvider.documents => await getApplicationDocumentsDirectory(),
      LogProvider.cache => await getApplicationCacheDirectory(),
      LogProvider.temp => await getTemporaryDirectory(),
      LogProvider.external => await getExternalStorageDirectory(),
    };
  } on UnsupportedError {
    return null;
  }
}

/// 應用日誌檔管理：動態檔名（跨午夜換檔）、追加、列表 / 讀取 / 寫入 / 刪除。
///
/// 對接前端 useAppLog（append / setKey）與 useAppLogger（list / read / write / remove / dir）。
class LogService {
  LogService({
    LogRootResolver? rootResolver,
    DateTime Function()? now,
    this.retention = const LogRetention(),
  })  : _rootResolver = rootResolver ?? _defaultRootResolver,
        _now = now ?? DateTime.now;

  /// 預設日誌目錄的保留策略；只清理預設目錄（網頁以 target 指定的位置不受影響）。
  final LogRetention retention;

  final LogRootResolver _rootResolver;

  /// 時鐘；測試可注入以驗證跨午夜換檔。每次寫入都重新取時間，所以換日不需要排程。
  final DateTime Function() _now;

  String _logKey = 'app';

  Directory? _cachedDir;

  Future<Directory> _logDir() async {
    final cached = _cachedDir;
    if (cached != null) {
      return cached;
    }
    final support = await _rootResolver(LogProvider.internal);
    if (support == null) {
      throw const LogTargetException('log_provider_unavailable', '本平台沒有內部目錄');
    }
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

  String? _prunedForDate;

  /// 依 [retention] 清理預設日誌目錄；出錯一律忽略（清理失敗不該影響寫 log）。
  Future<void> prune() async {
    if (retention.maxAge == null && retention.maxBytes == null) {
      return;
    }
    try {
      final dir = await _logDir();
      final stats = <LogFileStat>[];
      await for (final entity in dir.list()) {
        if (entity is File && entity.path.endsWith('.log')) {
          final stat = await entity.stat();
          stats.add(LogFileStat(path: entity.path, size: stat.size, modified: stat.modified));
        }
      }
      for (final path in selectLogFilesToDelete(stats, retention: retention, now: _now())) {
        try {
          await File(path).delete();
        } on FileSystemException {
          // 刪不掉（被占用等）就留著，下次再處理。
        }
      }
    } on Object {
      // 忽略。
    }
  }

  Future<File> _currentFile() async {
    final dir = await _logDir();
    final segment = _dateSegment(_now());
    // 第一次寫入與每次換日（建立當日新檔）時清理一次；不加排程、不在每次寫入掃描目錄。
    if (_prunedForDate != segment) {
      _prunedForDate = segment;
      await prune();
    }
    final name = '${_logKey}_$segment.log';
    return File(p.join(dir.path, name));
  }

  /// 依 [target] 解析檔案：先驗證，再取 provider 根目錄；不可用時丟出 `log_provider_unavailable`，不改寫到其他 provider。
  Future<File> _targetFile(LogTarget target) async {
    final segments = validateLogDir(target.dir);
    final name = target.name ?? _logKey;
    validateLogName(name);
    final root = await _rootResolver(target.provider);
    if (root == null) {
      throw LogTargetException('log_provider_unavailable', '本平台不支援 provider: ${target.provider.name}');
    }
    final dir = Directory(p.joinAll([root.path, ...segments]));
    await dir.create(recursive: true);
    return File(p.join(dir.path, '${name}_${_dateSegment(_now())}.log'));
  }

  /// 設定 log 檔名 key；下一筆 append 起寫入新檔。
  void setKey(String key) {
    _logKey = key;
  }

  /// 追加一行（含時間戳與層級）到當前 log 檔；[target] 省略時寫入預設位置。
  Future<void> append(String level, String message, {LogTarget? target}) async {
    final file = target == null ? await _currentFile() : await _targetFile(target);
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
