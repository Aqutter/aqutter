/// 預設日誌目錄的保留策略：超過保留天數的檔案，以及總容量超過上限時最舊的檔案會被刪除。
///
/// 只作用於殼的預設日誌目錄；網頁以 `target` 指定的其他位置由網頁自行管理，不受影響。
/// 欄位為 `null` 表示不限制該項。今天修改過的檔案永遠保留，避免刪到正在寫入的檔案。
class LogRetention {
  const LogRetention({
    this.maxAge = const Duration(days: 14),
    this.maxBytes = 20 * 1024 * 1024,
  });

  /// 完全不清理。
  static const LogRetention unlimited = LogRetention(maxAge: null, maxBytes: null);

  /// 檔案最後修改時間超過此長度就刪除。
  final Duration? maxAge;

  /// 目錄內日誌檔的總位元組上限；超過時由最舊的開始刪除。
  final int? maxBytes;
}

/// 一個日誌檔的清理判斷所需資訊。
class LogFileStat {
  const LogFileStat({required this.path, required this.size, required this.modified});

  final String path;
  final int size;
  final DateTime modified;
}

/// 依 [retention] 決定要刪哪些檔案（純函式，不碰檔案系統）。
///
/// 今天（以 [now] 的本地日期為準）修改過的檔案不會被選中，即使總容量因此仍超過上限。
List<String> selectLogFilesToDelete(
  List<LogFileStat> files, {
  required LogRetention retention,
  required DateTime now,
}) {
  bool isToday(DateTime time) {
    final local = time.toLocal();
    final today = now.toLocal();
    return local.year == today.year && local.month == today.month && local.day == today.day;
  }

  final doomed = <String>[];
  final kept = <LogFileStat>[];
  final maxAge = retention.maxAge;
  for (final file in files) {
    final expired = maxAge != null && !isToday(file.modified) && now.difference(file.modified) > maxAge;
    if (expired) {
      doomed.add(file.path);
    } else {
      kept.add(file);
    }
  }

  final maxBytes = retention.maxBytes;
  if (maxBytes != null) {
    kept.sort((a, b) => a.modified.compareTo(b.modified));
    var total = kept.fold<int>(0, (sum, file) => sum + file.size);
    for (final file in kept) {
      if (total <= maxBytes) {
        break;
      }
      if (isToday(file.modified)) {
        continue;
      }
      doomed.add(file.path);
      total -= file.size;
    }
  }
  return doomed;
}
