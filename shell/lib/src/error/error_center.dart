import 'dart:async';

import 'package:flutter/foundation.dart';

import '../bridge/bridge_emitter.dart';
import '../bridge/bridge_names.dart';
import 'aqutter_error_reporter.dart';
import 'crash_spool.dart';

/// 錯誤的集散點：Dart 端錯誤先寫入 [CrashSpool]（耐久），再派給 reporters，網頁就緒後以
/// `crash_reports` 事件交給網頁寫入目標檔案，網頁以 `crash_ack` 確認後才刪除。
class ErrorCenter {
  ErrorCenter({
    required this.spool,
    required this.emitter,
    this.reporters = const [],
  });

  final CrashSpool spool;
  final BridgeEmitter emitter;
  final List<AqutterErrorReporter> reporters;

  /// 一次最多送出的筆數（與 aqutter-js 契約成對）。
  static const int maxBatch = 50;

  bool _webReady = false;
  bool _flushAgain = false;

  /// 本代網頁是否已回報就緒；轉為就緒時立刻補送所有未確認的紀錄。
  set webReady(bool value) {
    _webReady = value;
    if (value) {
      unawaited(flush());
    }
  }

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

  /// 寫入待送紀錄、派給 reporters；網頁已就緒時立刻送出。
  Future<void> record(AqutterErrorReport report) async {
    try {
      await spool.add(report);
    } on Object catch (error) {
      debugPrint('[aqutter] crash spool 寫入失敗：$error');
    }
    _dispatch(report);
    if (_webReady) {
      await flush();
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

  /// 網頁確認已寫入，刪除對應的待送紀錄。
  Future<void> ack(Iterable<String> ids) => spool.ack(ids);

  Future<void>? _inFlight;

  /// 送出所有未確認的紀錄；同時間只跑一輪（重複呼叫會等同一輪完成），期間新增的由同一輪補上。
  Future<void> flush() {
    final running = _inFlight;
    if (running != null) {
      _flushAgain = true;
      return running;
    }
    return _inFlight = _flushLoop().whenComplete(() => _inFlight = null);
  }

  Future<void> _flushLoop() async {
    try {
      do {
        _flushAgain = false;
        if (!_webReady) {
          break;
        }
        final pending = await spool.pending();
        if (pending.isEmpty) {
          break;
        }
        await emitter.emit(BridgeEvent.crashReports, {
          'reports': [for (final report in pending.take(maxBatch)) report.toJson()],
        });
      } while (_flushAgain);
    } on Object catch (error) {
      debugPrint('[aqutter] crash_reports 送出失敗：$error');
    }
  }

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
