// 將網頁框架的靜態產物打包成 Flutter 殼的種子網頁包。
//
// 產物：<appDir>/assets/seed/web-bundle.zip，供 SeedBootstrapper 首開解壓。
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'

import type { Project } from './config.ts'
import { collectFiles, ensureSeedDir } from './shared.ts'

// 網頁包版本檔名；與殼的 bundle_archive.dart 及熱更新遠端契約共用同一個名稱。
const VERSION_ENTRY = 'version.json'

// 不得出現在網頁包內的副檔名。
const FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf']

/**
 * 確認網頁包不含字型檔。
 *
 * 字型由 Aqutter 殼經 shelf server 掛在 /_flutter/fonts/ 提供，dev 則由專案自己的 dev server
 * 供應；兩條路徑都不經過靜態資源目錄，所以正常情況下這裡永遠不會命中。它存在是為了讓
 * 「有人把字型放回靜態資源目錄」這件事在打包當下就失敗。
 *
 * 刻意是「斷言」而非排除規則：排除規則會安靜地把東西拿掉，而它與 assets/sql-wasm.wasm
 * 僅一層之隔——pattern 一旦被放寬成 assets/，SQLite 層會無聲失效且沒有任何錯誤訊息。
 * 斷言寫錯最多是誤報，一眼可見。
 */
export const assertNoFonts = (entryNames: string[]): void => {
  const fonts = entryNames.filter(name => FONT_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext)))
  if (fonts.length === 0) {
    return
  }
  throw new Error(
    `[syncSeed] 網頁包內不應出現字型檔（字型由 Aqutter 殼提供，見 /_flutter/fonts/）：\n  ${fonts.join('\n  ')}`,
  )
}

/**
 * 產生 `YYMMDDHHmmss` 版本識別（UTC）。
 *
 * 定長數字串，字典序即時序，故 SeedBootstrapper 可直接以字串比較判斷種子是否
 * 比已安裝的網頁包新。
 *
 * 刻意取 UTC 而非本地時間：跨時區的建置機（或 CI）產出的版本大小必須與實際
 * 先後一致，否則較晚的建置可能被判定為較舊而不予套用。
 * 取到秒是為了讓同一分鐘內的重新打包仍能被辨識為新版。
 */
export const buildVersion = (now: Date = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    pad(now.getUTCFullYear() % 100),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('')
}

/** 打包 `sourceDir`（相對專案根）為種子；回傳版本。 */
export const packSeed = (project: Project, sourceRelative: string): string => {
  const sourceDir = join(project.root, sourceRelative)
  const files = collectFiles(sourceDir)
  if (files.length === 0) {
    throw new Error(`[syncSeed] 找不到產物，請先產生靜態網頁（${sourceDir} 為空）`)
  }

  const zipEntries: Record<string, Uint8Array> = {}
  for (const file of files) {
    const name = relative(sourceDir, file).split('\\').join('/')
    zipEntries[name] = new Uint8Array(readFileSync(file))
  }

  assertNoFonts(Object.keys(zipEntries))

  // 同一個版本值寫兩處：zip 內的供解壓後成為 current/version.json（與熱更新共用比對基準），
  // zip 外的供冷啟不載入整包即可得知種子版本。
  const version = buildVersion()
  const versionJson = `${JSON.stringify({ version }, null, 2)}\n`
  zipEntries[VERSION_ENTRY] = new TextEncoder().encode(versionJson)

  ensureSeedDir(project)
  writeFileSync(project.seedBundle, zipSync(zipEntries))
  writeFileSync(project.seedVersion, versionJson)
  console.log(`[syncSeed] 已打包 ${Object.keys(zipEntries).length} 個檔案（版本 ${version}）→ ${project.seedBundle}`)
  return version
}
