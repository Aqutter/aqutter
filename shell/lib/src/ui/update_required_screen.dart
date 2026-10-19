import 'package:flutter/widgets.dart';

import 'basic_widgets.dart';

import '../server/bundle_manager.dart';

/// 嚴格模式（`AQUTTER_UPDATE_REQUIRED=true`）下版本查詢失敗的阻擋畫面。
///
/// 與 `HostUpdateScreen` 同一種版面，但語意相反：那一頁**沒有出口**（唯一的路是
/// 更新殼），這一頁的出口就是「重試」——連上伺服器、查詢成功，殼就會接手繼續啟動。
/// 刻意不把兩頁合併：一個有出口、一個沒有，合在一起只會讓按鈕的存在與否變成
/// 又一個旗標。
class UpdateRequiredScreen extends StatefulWidget {
  const UpdateRequiredScreen({
    super.key,
    required this.failure,
    required this.onRetry,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.accentColor,
  });

  /// 本次查詢失敗的原因；底層例外摘要顯示在說明之下供除錯。
  final UpdateCheckFailedException failure;

  /// 重試回呼；回傳的 Future 完成前按鈕維持 disabled，避免連按疊出多條查詢。
  final Future<void> Function() onRetry;

  final Color backgroundColor;
  final Color foregroundColor;
  final Color accentColor;

  @override
  State<UpdateRequiredScreen> createState() => _UpdateRequiredScreenState();
}

class _UpdateRequiredScreenState extends State<UpdateRequiredScreen> {
  bool _busy = false;

  Future<void> _retry() async {
    setState(() => _busy = true);
    try {
      await widget.onRetry();
    }
    finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final foreground = widget.foregroundColor;
    return AqutterSurface(
      color: widget.backgroundColor,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '無法確認版本',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: foreground, fontSize: 20, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  '需連上伺服器確認版本後才能繼續使用，請檢查網路連線後重試。',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: foreground),
                ),
                const SizedBox(height: 24),
                AqutterButton(
                  label: _busy ? '確認中…' : '重試',
                  onPressed: _busy ? null : _retry,
                  backgroundColor: widget.accentColor,
                  // 與 HostUpdateScreen 同一理由：accent 在深色主題是淺青，白字對比不足
                  foregroundColor: widget.backgroundColor,
                ),
                const SizedBox(height: 16),
                Text(
                  '${widget.failure.cause}',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: kAqutterErrorColor, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
