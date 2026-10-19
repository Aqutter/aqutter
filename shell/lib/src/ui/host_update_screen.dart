import 'package:flutter/widgets.dart';

import 'basic_widgets.dart';

import '../server/host_requirement.dart';
import '../server/host_updater.dart';
import '../server/host_version.dart';

/// 殼版本低於伺服器要求時的阻擋畫面。
///
/// 與 `StartupOverlay` 不同，這一頁**沒有出口**：不掛 WebView、不會自行消失，
/// 唯一的路是更新殼。按鈕的文案與行為由 [requirement.updateType] 決定，
/// 沒有 `updateUrl` 時只顯示訊息。
class HostUpdateScreen extends StatefulWidget {
  const HostUpdateScreen({
    super.key,
    required this.requirement,
    required this.host,
    required this.updater,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.accentColor,
  });

  final HostRequirement requirement;
  final HostVersion host;
  final HostUpdater updater;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color accentColor;

  @override
  State<HostUpdateScreen> createState() => _HostUpdateScreenState();
}

class _HostUpdateScreenState extends State<HostUpdateScreen> {
  bool _busy = false;

  /// 下載進度（0–1）；null 為不定量或尚未開始。
  double? _progress;
  String? _error;

  bool get _isApk => widget.requirement.updateType == HostUpdateType.apk;

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
      _progress = null;
    });
    try {
      await widget.updater.start(widget.requirement, onProgress: _onProgress);
    }
    catch (e) {
      if (!mounted) {
        return;
      }
      setState(() => _error = '$e');
    }
    finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  void _onProgress(int received, int total) {
    if (!mounted) {
      return;
    }
    setState(() => _progress = total > 0 ? received / total : null);
  }

  @override
  Widget build(BuildContext context) {
    final requirement = widget.requirement;
    final foreground = widget.foregroundColor;
    final error = _error;
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
                  '請更新 App',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: foreground, fontSize: 20, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  '目前的 App 版本（${widget.host.name}，build ${widget.host.buildNumberRaw}）'
                  '低於伺服器要求（build ${requirement.minBuildNumber}），需先更新才能繼續使用。',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: foreground),
                ),
                if (requirement.updateUrl != null) ...[
                  const SizedBox(height: 24),
                  if (_busy && _isApk) ...[
                    AqutterProgressBar(
                      value: _progress,
                      color: widget.accentColor,
                      trackColor: widget.accentColor.withValues(alpha: 0.24),
                    ),
                    const SizedBox(height: 16),
                  ],
                  AqutterButton(
                    label: _isApk ? '下載並安裝' : '前往更新',
                    onPressed: _busy ? null : _start,
                    backgroundColor: widget.accentColor,
                    // 前景取 surface 色：accent 在深色主題是淺青，白字會糊掉
                    foregroundColor: widget.backgroundColor,
                  ),
                ],
                if (error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    error,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: kAqutterErrorColor, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
