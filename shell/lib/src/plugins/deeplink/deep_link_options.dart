/// 內建 plugin `deeplink` 的選項，由 `AqutterConfig.deepLink` 傳入。
///
/// 處理順序：scheme／host 白名單 → [transform] → 送進網頁。`initial` 與事件 `received` 走同一條管線；
/// 不設定時連結原樣送出。
class DeepLinkOptions {
  const DeepLinkOptions({
    this.allowedSchemes,
    this.allowedHosts,
    this.transform,
  });

  /// 允許的 scheme（不分大小寫，不含 `:`）；null 代表不限制。
  final Set<String>? allowedSchemes;

  /// 允許的主機名稱（不分大小寫）；null 代表不限制。設定後沒有主機的連結一律丟棄。
  final Set<String>? allowedHosts;

  /// 把通過白名單的連結轉成網頁要的形態（例如把自訂 scheme 轉成路由路徑）；回 null 或丟例外代表丟棄。
  final String? Function(String url)? transform;

  /// 套用選項；被丟棄時回 null。
  String? apply(String url) {
    final schemes = allowedSchemes;
    final hosts = allowedHosts;
    if (schemes != null || hosts != null) {
      final uri = Uri.tryParse(url);
      if (uri == null) {
        return null;
      }
      if (schemes != null && !schemes.map((s) => s.toLowerCase()).contains(uri.scheme.toLowerCase())) {
        return null;
      }
      if (hosts != null && !hosts.map((h) => h.toLowerCase()).contains(uri.host.toLowerCase())) {
        return null;
      }
    }
    final convert = transform;
    if (convert == null) {
      return url;
    }
    try {
      return convert(url);
    } catch (_) {
      return null;
    }
  }
}
