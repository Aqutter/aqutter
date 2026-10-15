import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// 以 drift 作為「raw SQL 執行器」的最小資料庫。
///
/// 前端 Kysely 已擁有 schema 與 migration；drift 在此不定義 table、不做 migration，
/// 僅提供單一序列化連線執行前端傳來的已編譯 SQL。
class _RawDriftDatabase extends GeneratedDatabase {
  _RawDriftDatabase(super.executor);

  @override
  Iterable<TableInfo<Table, dynamic>> get allTables => const [];

  @override
  int get schemaVersion => 1;
}

/// 單一資料庫連線包裝，負責 SQL 前綴路由與結果整形。
class DriftConnection {
  // 建構子刻意為私有：唯一的建立點是同檔的 DriftExecutor.open，
  // 且參數型別 _RawDriftDatabase 本身是私有實作細節，公開建構子會把它洩漏到公開 API。
  DriftConnection._(this._db);

  final _RawDriftDatabase _db;

  /// 是否為需要取回資料列的語句（對齊前端 TauriSqlKyselyDialect 的判斷）。
  bool _isRowReturning(String sql) {
    final lower = sql.trimLeft().toLowerCase();
    return lower.startsWith('select')
        || lower.startsWith('pragma')
        || lower.contains('returning');
  }

  List<Variable> _toVariables(List<dynamic> bind) {
    return bind.map((value) => Variable(value)).toList();
  }

  /// 執行單句 SQL；查詢回 `{rows}`，異動回 `{changes, insertId}`。
  Future<Map<String, dynamic>> exec(String sql, List<dynamic> bind) async {
    final variables = _toVariables(bind);

    if (_isRowReturning(sql)) {
      final rows = await _db.customSelect(sql, variables: variables).get();
      return {'rows': rows.map((row) => row.data).toList()};
    }

    await _db.customStatement(sql, bind);
    // changes() 與 last_insert_rowid() 反映同一連線上最近一次語句；drift 序列化保證正確順序
    final meta = await _db
        .customSelect('SELECT changes() AS changes, last_insert_rowid() AS insertId')
        .getSingle();
    return {
      'changes': meta.data['changes'],
      'insertId': meta.data['insertId'],
    };
  }

  Future<void> close() => _db.close();
}

/// 管理多個具名 / 路徑指定的資料庫連線。
class DriftDatabaseManager {
  final Map<String, DriftConnection> _connections = {};

  /// 依 name（app 目錄下 `${name}.db`）或 path（絕對路徑，NC 模式）解析出連線鍵。
  /// 與前端 FlutterSqlKyselyDialect.resolveDbName 一致：path 優先。
  String _resolveKey(String? name, String? path) {
    if (path != null && path.isNotEmpty) {
      return path;
    }
    if (name != null && name.isNotEmpty) {
      return name;
    }
    throw ArgumentError('db_open requires either name or path');
  }

  Future<String> _resolveFilePath(String? name, String? path) async {
    if (path != null && path.isNotEmpty) {
      return path;
    }
    final dir = await getApplicationDocumentsDirectory();
    return p.join(dir.path, '$name.db');
  }

  /// 開啟（或取得既有）資料庫連線。回傳連線鍵，供後續 db_exec 使用。
  Future<String> open({String? name, String? path}) async {
    final key = _resolveKey(name, path);
    if (_connections.containsKey(key)) {
      return key;
    }
    final filePath = await _resolveFilePath(name, path);
    final file = File(filePath);
    // 單一連線（非背景連線池），確保手動 BEGIN/COMMIT 的語句順序與交易正確
    final db = _RawDriftDatabase(NativeDatabase(file));
    _connections[key] = DriftConnection._(db);
    return key;
  }

  /// 對指定連線執行 SQL。
  Future<Map<String, dynamic>> exec(String key, String sql, List<dynamic> bind) {
    final connection = _connections[key];
    if (connection == null) {
      throw StateError('Database "$key" is not opened');
    }
    return connection.exec(sql, bind);
  }
}
