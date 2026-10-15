import 'package:flutter/material.dart';

/// 啟動與更新過程的階段。
///
/// 冷啟依序經歷 [preparingBundle] → [preparingFonts] → [checkingUpdate]
/// →（有更新時）[downloadingUpdate] → [startingServer] → [loadingWeb]；
/// dev 模式跳過前五段，直接是 [loadingWeb]。
/// [applyingUpdate] 屬執行期更新（使用者主動觸發），不出現在冷啟路徑。
enum StartupStage {
  preparingBundle('準備網頁包…'),
  preparingFonts('準備字型…'),
  checkingUpdate('確認版本…', step: '確認版本', completedSteps: 0),
  downloadingUpdate('下載更新…', step: '下載更新', completedSteps: 1),
  extracting('解開網頁包…', step: '解開網頁包', completedSteps: 2),
  startingServer('啟動伺服器…', completedSteps: 3),
  loadingWeb('載入網頁…', step: '載入網頁', completedSteps: 3),
  applyingUpdate('正在更新…'),
  rollingBack('更新失敗，回復上一版…');

  const StartupStage(this.message, {this.step, this.completedSteps = 0});

  /// 顯示於過場最上方的階段文字。
  final String message;

  /// 在步驟清單中的名稱；null 表示不列入清單。
  ///
  /// 清單刻意只放**使用者會等到的**四個步驟。準備種子 / 字型 / 啟動伺服器都是
  /// 毫秒等級，列出來只會讓畫面在一瞬間閃過四個已完成的列，反而看不出重點。
  final String? step;

  /// 處於本階段時，步驟清單中**已經走完**的數量。
  ///
  /// 刻意明寫而非由 [index] 推導：`applyingUpdate` / `rollingBack` 在列舉順序上排在
  /// 最後，但它們其實是整段流程的**起點**，用 index 推導會直接算成 100%。
  /// `startingServer` 則夾在解包與載入之間，也沒有對應的步驟列。
  final int completedSteps;

  /// 步驟清單（依列舉順序），供過場逐列呈現。
  static List<StartupStage> get steps =>
      values.where((stage) => stage.step != null).toList(growable: false);
}

/// 滿版過場，疊在 WebView 之上，直到網頁回報就緒才淡出。
///
/// 刻意**不包 `SafeArea`**：與 WebView 同為全屏 edge-to-edge，插邊由
/// `SafeAreaInjector` 注入給網頁端處理，原生層若也留一次白會變成雙倍間距。
///
/// 本元件只負責呈現。何時切換階段、何時淡出、何時自 `Stack` 移除，全由呼叫端決定——
/// 過場的生命週期與 bootstrap 流程和 bridge 事件綁在一起，那些狀態不屬於這裡。
class StartupOverlay extends StatelessWidget {
  const StartupOverlay({
    super.key,
    required this.stage,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.indicatorColor,
    required this.visible,
    required this.onHidden,
    this.progress,
    this.visitedStages = const {},
  });

  /// 淡出時長。夠短到不拖慢啟動感受，夠長到不像瞬間閃掉。
  static const Duration fadeDuration = Duration(milliseconds: 240);

  /// 目前階段；決定顯示的文字。
  final StartupStage stage;

  /// 過場底色；由呼叫端依 App 主題傳入，與 `Scaffold` 底色同一組。
  final Color backgroundColor;

  /// 階段文字的顏色；同樣由呼叫端依 App 主題傳入。
  ///
  /// 刻意不靠 `ThemeData` 取色：本 App 的 `MaterialApp` 未設 theme，預設的淺色
  /// ThemeData 會把文字固定成近黑，深色底下實測只有 1.07:1 的對比度。
  final Color foregroundColor;

  /// 進度指示器的顏色；不指定會取到 Material 預設的紫色。
  final Color indicatorColor;

  /// 為 false 時開始淡出，動畫結束後觸發 [onHidden]。
  final bool visible;

  /// 淡出動畫結束後的回呼，供呼叫端把本元件自 `Stack` 移除。
  final VoidCallback onHidden;

  /// **目前這個階段**的進度 0–1；null 為不定量（該階段無從估算，或伺服器未回報
  /// content-length）。刻意不是「總進度」——總進度在下載大包時會長時間停在同一個
  /// 數字，看起來像當掉，而分階段能讓使用者看出卡在哪一步。
  final double? progress;

  /// 已經歷過的階段。用來區分「做完了」與「跳過了」——未啟用 OTA 時
  /// 下載與解包根本不會發生，把它們畫成已完成是不誠實的。
  final Set<StartupStage> visitedStages;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      // 淡出期間放行點擊：此時網頁已就緒，再攔下去會吃掉使用者的第一次操作
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: fadeDuration,
        onEnd: visible ? null : onHidden,
        child: ColoredBox(
          color: backgroundColor,
          child: Center(
            child: ConstrainedBox(
              // 步驟清單需要固定寬度才不會隨文字長短跳動；上限避免在平板上拉成一整排
              constraints: const BoxConstraints(maxWidth: 320),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      stage.message,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: foregroundColor),
                    ),
                    const SizedBox(height: 20),
                    // 整體進度：四個步驟等權重，當前步驟的自身進度按比例計入。
                    // 與下方的分階段清單互補——這條回答「還要多久」，清單回答「卡在哪」。
                    _OverallBar(
                      value: _overallProgress,
                      foregroundColor: foregroundColor,
                      indicatorColor: indicatorColor,
                    ),
                    const SizedBox(height: 20),
                    for (final step in StartupStage.steps) ...[
                      _StepRow(
                        label: step.step!,
                        status: _statusOf(step),
                        progress: step == stage ? progress : null,
                        foregroundColor: foregroundColor,
                        indicatorColor: indicatorColor,
                      ),
                      if (step != StartupStage.steps.last) const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 整體進度 0–1。
  ///
  /// 四個步驟等權重：已走完的算滿，當前步驟按自身進度計入。當前階段不在清單中
  /// （如啟動伺服器）時只算已走完的部分——那些階段是毫秒等級，硬給它們一份權重
  /// 只會讓進度條在使用者還沒看清楚時就跳掉一格。
  double get _overallProgress {
    final total = StartupStage.steps.length;
    final current = stage.step != null ? (progress ?? 0) : 0;
    return ((stage.completedSteps + current) / total).clamp(0.0, 1.0);
  }

  /// 判定某個步驟該畫成什麼狀態。
  ///
  /// 「已跳過」與「已完成」必須分開：未啟用 OTA 時下載與解包根本不會發生，
  /// 而回滾之類的路徑也會略過部分步驟——把沒做過的事畫成完成，等於謊報。
  _StepStatus _statusOf(StartupStage step) {
    if (step == stage) {
      return _StepStatus.active;
    }
    if (visitedStages.contains(step)) {
      return _StepStatus.done;
    }
    return step.index < stage.index ? _StepStatus.skipped : _StepStatus.pending;
  }
}

/// 步驟在清單中的呈現狀態。
enum _StepStatus { done, active, skipped, pending }

/// 步驟清單的單列：標籤 + 該步驟自己的進度條。
class _StepRow extends StatelessWidget {
  const _StepRow({
    required this.label,
    required this.status,
    required this.progress,
    required this.foregroundColor,
    required this.indicatorColor,
  });

  final String label;
  final _StepStatus status;

  /// 僅 [status] 為 active 時有意義；null 代表該階段無從估算，畫成不定量。
  final double? progress;

  final Color foregroundColor;
  final Color indicatorColor;

  @override
  Widget build(BuildContext context) {
    // 未進行中的列刻意壓低對比：四列同等醒目會讓人找不到現在在哪一步
    final isActive = status == _StepStatus.active;
    final labelColor = isActive
        ? foregroundColor
        : foregroundColor.withValues(alpha: 0.5);

    final barValue = switch (status) {
      _StepStatus.active => progress,
      _StepStatus.done => 1.0,
      _StepStatus.skipped || _StepStatus.pending => 0.0,
    };

    final suffix = switch (status) {
      _StepStatus.active when progress != null => '${(progress! * 100).round()}%',
      _StepStatus.done => '完成',
      _StepStatus.skipped => '略過',
      _ => '',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: labelColor, fontSize: 13)),
            Text(suffix, style: TextStyle(color: labelColor, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: barValue,
            minHeight: 4,
            color: isActive || status == _StepStatus.done
                ? indicatorColor
                : indicatorColor.withValues(alpha: 0.25),
            backgroundColor: foregroundColor.withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }
}

/// 整體進度條；比分階段的列粗，並附百分比。
class _OverallBar extends StatelessWidget {
  const _OverallBar({
    required this.value,
    required this.foregroundColor,
    required this.indicatorColor,
  });

  final double value;
  final Color foregroundColor;
  final Color indicatorColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('整體進度', style: TextStyle(color: foregroundColor, fontSize: 13)),
            Text(
              '${(value * 100).round()}%',
              style: TextStyle(color: foregroundColor, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 8,
            color: indicatorColor,
            backgroundColor: foregroundColor.withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }
}
