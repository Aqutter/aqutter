import 'dart:async';

import 'package:flutter/foundation.dart';

import '../bridge/bridge_emitter.dart';
import '../bridge/bridge_names.dart';
import 'aqutter_error_reporter.dart';
import 'crash_spool.dart';

/// 錯誤的集散點：Dart 端錯誤先寫入 [CrashSpool]（耐久），再派給 reporters。
///
/// 網頁（`installConsoleLog`）呼叫 `crash_take` 取回所有未確認的紀錄，並從此刻起由殼以
/// `crash_reports` 事件逐筆推送新紀錄；網頁寫入目標檔案後以 `crash_ack` 確認，殼才刪除。
/// 事件在網頁未連線時會被丟棄，但紀錄仍在 spool，下次 `crash_take` 一定取得。
class ErrorCenter {
  ErrorCenter({
    required this.emitter,
    this.spool,
    this.reporters = const [],
  });

  /// 待送紀錄；為 null 表示 App 選擇不落檔，此時錯誤只派給 [reporters]，網頁取不到任何紀錄。
  final CrashSpool? spool;
  final BridgeEmitter emitter;
  final List<AqutterErrorReporter> reporters;

  /// `crash_take` 一次最多回傳的筆數（與 aqutter-js 契約成對）。
  static const int maxBatch = 50;

  bool _subscribed = false;

  /// [FlutterError.onError] 的錯誤（框架層，App 仍可運作）。
  Future<void> recordFlutter(FlutterErrorDetails details) {
    return record(
      AqutterErrorReport.create(
        source: AqutterErrorSource.flutter,
        fatal: false,
        message: details.exceptionAsString(),
        stack: details.stack?.toString(),
        extra: {
          if (details.library != null) 'library': details.library!,
          if (details.context != null) 'context': details.context!.toDescription(),
        },
      ),
    );
  }

  /// [PlatformDispatcher.onError] 的錯誤（非同步未捕捉）。
  Future<void> recordPlatform(Object error, StackTrace stack) {
    return record(
      AqutterErrorReport.create(
        source: AqutterErrorSource.platform,
        fatal: true,
        message: '$error',
        stack: stack.toString(),
      ),
    );
  }

  /// 寫入待送紀錄、派給 reporters；網頁已訂閱時立刻推送這一筆。
  Future<void> record(AqutterErrorReport report) async {
    try {
      await spool?.add(report);
    } on Object catch (error) {
      debugPrint('[aqutter] crash spool 寫入失敗：$error');
    }
    _dispatch(report);
    if (_subscribed && spool != null) {
      try {
        await emitter.emit(BridgeEvent.crashReports, {
          'reports': [report.toJson()],
        });
      } on Object catch (error) {
        debugPrint('[aqutter] crash_reports 送出失敗：$error');
      }
    }
  }

  /// 網頁端回報的未捕捉錯誤：只派給 reporters（網頁已自行寫檔，不進待送紀錄）。
  void reportFromWeb({required String message, String? stack, required bool fatal}) {
    _dispatch(
      AqutterErrorReport.create(
        source: AqutterErrorSource.web,
        fatal: fatal,
        message: message,
        stack: stack,
      ),
    );
  }

  /// `crash_take`：回傳未確認的紀錄（最多 [maxBatch] 筆、由舊到新），並開始推送新紀錄。
  Future<List<AqutterErrorReport>> take() async {
    _subscribed = true;
    final pending = await spool?.pending() ?? const <AqutterErrorReport>[];
    return pending.take(maxBatch).toList();
  }

  /// 網頁確認已寫入，刪除對應的待送紀錄。
  Future<void> ack(Iterable<String> ids) async => spool?.ack(ids);

  void _dispatch(AqutterErrorReport report) {
    for (final reporter in reporters) {
      try {
        reporter.report(report);
      } on Object catch (error) {
        debugPrint('[aqutter] error reporter 失敗：$error');
      }
    }
  }
}

/// 掛上 Dart 端全域錯誤處理；回傳還原函式（測試用）。
///
/// 保留原本的 [FlutterError.onError]（預設會把錯誤印到 console）。[PlatformDispatcher.onError]
/// 回傳 `true` 表示已處理，因此這裡自己印出，避免錯誤在 debug 時無聲消失。
VoidCallback installErrorHooks(ErrorCenter center) {
  final previousFlutter = FlutterError.onError;
  final previousPlatform = PlatformDispatcher.instance.onError;

  FlutterError.onError = (details) {
    if (previousFlutter != null) {
      previousFlutter(details);
    } else {
      FlutterError.presentError(details);
    }
    unawaited(center.recordFlutter(details));
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[aqutter] 未捕捉的非同步錯誤：$error\n$stack');
    unawaited(center.recordPlatform(error, stack));
    return true;
  };

  return () {
    FlutterError.onError = previousFlutter;
    PlatformDispatcher.instance.onError = previousPlatform;
  };
}
