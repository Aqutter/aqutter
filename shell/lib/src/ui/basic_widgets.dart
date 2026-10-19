import 'package:flutter/widgets.dart';

/// 錯誤文字色。殼不依賴 Material，沒有 `ColorScheme.error` 可取，這是 Material 3 淺色主題的 error 色。
const Color kAqutterErrorColor = Color(0xFFB3261E);

/// 全螢幕底色容器，取代 `Scaffold`：底色、預設文字樣式，以及鍵盤彈出時把內容縮成「螢幕高 − 鍵盤高」。
///
/// 鍵盤縮排刻意沿用 `Scaffold` 的 `resizeToAvoidBottomInset: true` 行為：WebView 本身縮小，
/// 網頁的 layout viewport 因此真的變小，捲動容器的頂端與底端都捲得到（詳見 wiki 的 keyboard-avoidance）。
/// 子樹的 `MediaQuery` 會移除已經消耗掉的底部 inset，避免下層再扣一次。
class AqutterSurface extends StatelessWidget {
  const AqutterSurface({super.key, required this.color, required this.child});

  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: color,
      child: DefaultTextStyle(
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400, decoration: TextDecoration.none),
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: MediaQuery.removeViewInsets(context: context, removeBottom: true, child: child),
        ),
      ),
    );
  }
}

/// 實心按鈕，取代 `FilledButton`；[onPressed] 為 null 時停用。
class AqutterButton extends StatelessWidget {
  const AqutterButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(24)),
            child: Text(
              label,
              style: TextStyle(color: foregroundColor, fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
        ),
      ),
    );
  }
}

/// 水平進度條，取代 `LinearProgressIndicator`：[value] 為 0..1；null 表示不確定，改為來回滑動的色塊。
class AqutterProgressBar extends StatefulWidget {
  const AqutterProgressBar({
    super.key,
    required this.value,
    required this.color,
    required this.trackColor,
    this.height = 4,
  });

  final double? value;
  final Color color;
  final Color trackColor;
  final double height;

  @override
  State<AqutterProgressBar> createState() => _AqutterProgressBarState();
}

class _AqutterProgressBarState extends State<AqutterProgressBar> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void initState() {
    super.initState();
    _syncAnimation();
  }

  @override
  void didUpdateWidget(AqutterProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncAnimation();
  }

  /// 只有不確定模式才跑動畫；確定模式靜止，不白白占用每一幀。
  void _syncAnimation() {
    if (widget.value == null) {
      if (!_controller.isAnimating) {
        _controller.repeat();
      }
    }
    else {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    return SizedBox(
      height: widget.height,
      child: ColoredBox(
        color: widget.trackColor,
        child: value != null
            ? Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: value.clamp(0.0, 1.0),
                  heightFactor: 1,
                  child: ColoredBox(color: widget.color),
                ),
              )
            : AnimatedBuilder(
                animation: _controller,
                builder: (context, _) => FractionallySizedBox(
                  alignment: Alignment(-1 + 2 * Curves.easeInOut.transform(_controller.value), 0),
                  widthFactor: 0.3,
                  heightFactor: 1,
                  child: ColoredBox(color: widget.color),
                ),
              ),
      ),
    );
  }
}
