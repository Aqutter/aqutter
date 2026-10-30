/// 下載檔名的最大長度（UTF-16 單元）。
const int _maxFileNameLength = 128;

/// 路徑分隔、磁碟機代號與 Windows 不允許的字元；它們出現在檔名裡就代表想指向別的位置。
final RegExp _forbiddenFileNameChars = RegExp(r'[\\/:*?"<>|\u0000-\u001f]');

/// `download` 的 `fileName` 是否是單純的一個檔名；合法回傳 null，否則回傳原因。
///
/// 檔名會直接接在文件目錄後面，所以只要含分隔符或上層參照，網頁就能把檔案寫到
/// 文件目錄之外。這裡只允許「一個檔名」：不含任何路徑分隔、不是 `.` 或 `..`、不為空、不過長。
/// 中文等非 ASCII 檔名照常放行。
String? downloadFileNameProblem(Object? value) {
  if (value is! String) {
    return 'fileName 必須是字串';
  }
  if (value.isEmpty || value.length > _maxFileNameLength) {
    return 'fileName 不得為空且長度 ≤ $_maxFileNameLength';
  }
  if (value == '.' || value == '..') {
    return 'fileName 不得為 . 或 ..';
  }
  if (_forbiddenFileNameChars.hasMatch(value)) {
    return 'fileName 不得含路徑分隔或特殊字元';
  }
  if (value.endsWith('.') || value.endsWith(' ')) {
    return 'fileName 不得以點或空白結尾';
  }
  return null;
}
