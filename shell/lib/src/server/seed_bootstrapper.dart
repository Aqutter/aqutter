import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;

import 'bundle_archive.dart';

/// 打包於 assets 的「種子網頁包」解壓器。
///
/// 熱更新以可寫目錄 `web/current/` 為服務根；首次啟動該目錄為空，
/// 本類別把打包在 assets 的種子 zip 解壓進去，提供離線首開與 rollback 保底。
/// App 升版帶來較新的種子時亦由本類別覆蓋上去——否則在未啟用線上更新的部署下，
/// 使用者更新 App 後跑的仍會是首裝當時的舊網頁包。
///
/// 未來若改為純遠端（首開即下載整包），可整支移除本類別，
/// 並刪除 pubspec.yaml 的 `assets/seed/` 與 main 中的呼叫——
/// server / 熱更新主流程不受影響。
class SeedBootstrapper {
  /// 打包於 assets 的種子網頁包路徑。
  static const String _seedAsset = 'assets/seed/web-bundle.zip';

  /// 種子的版本標記；與 zip 內 `version.json` 同值，由 scripts/syncSeed.mjs 同時產生。
  /// 刻意獨立於 zip 之外，冷啟才能不載入整包就判定種子新舊。
  static const String _seedVersionAsset = 'assets/seed/seed-version.json';

  /// 確保 [currentDir] 為最新可服務版本；需要覆蓋時經 [stagingDir] 原子換名。
  ///
  /// [stagingDir] 由呼叫端指定，本類別不假設目錄佈局。
  Future<void> ensureSeed({
    required Directory currentDir,
    required Directory stagingDir,
    BundleExtractProgress? onExtractProgress,
  }) async {
    final seedVersion = await readSeedVersion();
    if (!await _shouldApply(currentDir, seedVersion)) {
      return;
    }

    final data = await rootBundle.load(_seedAsset);
    await extractBundle(
      stagingDir,
      data.buffer.asUint8List(),
      onProgress: onExtractProgress,
    );
    await commitBundle(stagingDir, currentDir);
  }

  /// 讀取種子自身的版本；資源缺席或毀損時回傳 null。
  Future<String?> readSeedVersion() async {
    try {
      final raw = await rootBundle.loadString(_seedVersionAsset);
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return json['version'] as String?;
    }
    catch (_) {
      // 本次改版前打包的種子沒有這個資源；無從判斷版本，交由 _shouldApply 保守處理
      return null;
    }
  }

  /// 是否該把種子覆蓋上 [currentDir]。
  ///
  /// 判準刻意是「種子確實較新」而非「版本不一致」——使用者可能已透過熱更新
  /// 取得比種子更新的網頁包，無條件覆蓋會把他們踢回 App 內建的舊版。
  Future<bool> _shouldApply(Directory currentDir, String? seedVersion) async {
    // 首開：沒有可服務的內容，必須解壓
    if (!await hasBundleContent(currentDir)) {
      return true;
    }
    // 種子無版本標記：無從比較新舊，保守留住既有內容
    if (seedVersion == null) {
      return false;
    }
    final currentVersion = await readBundleVersion(currentDir);
    // current 無版本標記＝本次改版前解壓的種子，一律視為較舊
    if (currentVersion == null) {
      return true;
    }
    // 版本為 YYMMDDHHmmss（UTC）定長時戳，字典序即時序
    return seedVersion.compareTo(currentVersion) > 0;
  }
}
