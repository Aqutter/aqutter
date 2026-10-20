// aqutter doctor：唯讀檢查專案與「這支 CLI 所代表的框架版本」是否一致，並指出怎麼修。
//
// 檢查項目：
//   1. 本機 Flutter 版本是否符合框架要求
//   2. <appDir>/pubspec.yaml 的 environment（sdk / flutter）與殼依賴 ref
//   3. <appDir>/.fvmrc 的 Flutter 版本（只在檔案已存在時檢查；FVM 是選配，框架不要求）
//   4. package.json 裡 @aqutter/aqutter、@aqutter/aqutter-cli 的 ref
//   5. <appDir>/pubspec.lock 鎖的 commit 是否落後遠端 ref（開發階段 tag 會移動，lock 會過期）
// 「框架版本」以 CLI 自帶的範本與 CLI 版本為準（見 expectedProfile）。
//
// 用法：aqutter doctor [--offline]
//   --offline : 不連網（略過第 5 項的遠端比對）
// 結束碼：有「錯誤」才為 1；只有「警告」仍為 0。

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import pkg from '../../package.json'
import type { Project } from '../config.ts'
import { IS_WIN } from '../shared.ts'
import { findTemplateRoot } from '../template.ts'
import {
  LOCKED_PACKAGES,
  SHELL_PACKAGE,
  lowerBound,
  parseFvmrc,
  parseLock,
  parsePubspec,
  readNpmSpecs,
  satisfies,
} from '../versioning.ts'
import type { LockGitPackage, NpmSpec, PubspecInfo } from '../versioning.ts'

const TAG = 'doctor'

/** 這支 CLI 所代表的框架版本：由自帶的範本與 CLI 版本推得。 */
export interface ExpectedProfile {
  sdk: string
  flutter: string
  /** 框架基準的確切 Flutter 版本：取 `flutter` 約束的下限（例如 `>=3.47.4 <3.48.0` → 3.47.4）。 */
  flutterVersion: string
  shellRef: string
}

export const expectedProfile = (templateRoot = findTemplateRoot()): ExpectedProfile => {
  const info = parsePubspec(readFileSync(join(templateRoot, 'app', 'pubspec.yaml'), 'utf8'))
  const flutterVersion = info.flutter ? lowerBound(info.flutter) : null
  if (!info.sdk || !info.flutter || !flutterVersion) {
    throw new Error('CLI 自帶的範本缺少 environment.sdk / environment.flutter（需有 >= 下限），無法判斷框架版本（CLI 安裝是否完整？）。')
  }
  return { sdk: info.sdk, flutter: info.flutter, flutterVersion, shellRef: pkg.version }
}

export type Level = 'ok' | 'warn' | 'error'

export interface Finding {
  level: Level
  title: string
  detail?: string
  /** 建議的修法。 */
  fix?: string
}

/** 蒐集到的事實；`null` 表示該檔案不存在或無法取得。 */
export interface Facts {
  expected: ExpectedProfile
  installedFlutter: string | null
  pubspec: PubspecInfo | null
  /** `.fvmrc`（FVM 使用者自己放的選配檔）；沒有這個檔案為 null，此時不檢查。`version` 為 null 表示內容無法解析。 */
  fvmrc: { version: string | null } | null
  npmSpecs: NpmSpec[]
  lock: Record<string, LockGitPackage> | null
  /**
   * 遠端 ref 目前指向的 commit，鍵為 `<url>#<ref>`；值為 null 表示查詢失敗。
   * `undefined`（整個欄位省略）表示不查（--offline）。
   */
  remote?: Record<string, string | null>
}

const UPGRADE_HINT = '執行 `aqutter upgrade`'

export const diagnose = (facts: Facts): Finding[] => {
  const { expected } = facts
  const findings: Finding[] = []
  const add = (finding: Finding): void => {
    findings.push(finding)
  }

  // 1. 本機 Flutter
  if (facts.installedFlutter === null) {
    add({ level: 'error', title: '找不到 flutter 指令', fix: `安裝 Flutter ${expected.flutterVersion}，並確認 flutter 在 PATH 上。` })
  }
  else {
    const within = satisfies(facts.installedFlutter, expected.flutter)
    if (within === false) {
      add({
        level: 'error',
        title: `Flutter 版本不符：已安裝 ${facts.installedFlutter}，框架要求 ${expected.flutter}`,
        fix: `改用 Flutter ${expected.flutterVersion}（用哪種工具切換版本由你決定，FVM 只是選項之一）。`,
      })
    }
    else if (facts.installedFlutter !== expected.flutterVersion) {
      add({
        level: 'warn',
        title: `Flutter ${facts.installedFlutter} 在允許範圍內，但框架基準是 ${expected.flutterVersion}`,
        fix: `建議切換到 ${expected.flutterVersion}，與團隊一致。`,
      })
    }
    else {
      add({ level: 'ok', title: `Flutter ${facts.installedFlutter}` })
    }
  }

  // 2. pubspec
  if (facts.pubspec === null) {
    add({ level: 'error', title: '找不到 App 的 pubspec.yaml', fix: '確認 aqutter.config.json 的 appDir，或執行 `aqutter init`。' })
  }
  else {
    const { pubspec } = facts
    if (pubspec.flutter === expected.flutter && pubspec.sdk === expected.sdk) {
      add({ level: 'ok', title: `pubspec environment（flutter ${pubspec.flutter}）` })
    }
    else {
      add({
        level: 'warn',
        title: `pubspec environment 與框架不一致：flutter ${pubspec.flutter ?? '（未設定）'}、sdk ${pubspec.sdk ?? '（未設定）'}`,
        detail: `框架要求 flutter ${expected.flutter}、sdk ${expected.sdk}`,
        fix: UPGRADE_HINT,
      })
    }
    if (pubspec.shell === null) {
      add({ level: 'warn', title: `pubspec 沒有 ${SHELL_PACKAGE} 依賴`, fix: '確認這是 aqutter 產生的 App 目錄。' })
    }
    else if (pubspec.shell.kind === 'path') {
      add({ level: 'ok', title: `殼依賴指向本機路徑（${pubspec.shell.path}），略過 ref 檢查` })
    }
    else if (pubspec.shell.ref === expected.shellRef) {
      add({ level: 'ok', title: `殼 ref ${pubspec.shell.ref}` })
    }
    else {
      add({
        level: 'warn',
        title: `殼 ref 是 ${pubspec.shell.ref ?? '（未設定）'}，這支 CLI 對應 ${expected.shellRef}`,
        fix: UPGRADE_HINT,
      })
    }
  }

  // 3. .fvmrc：選配。專案沒有就完全不檢查，不要求任何人使用 FVM。
  if (facts.fvmrc !== null) {
    if (facts.fvmrc.version === null) {
      add({ level: 'warn', title: '.fvmrc 不是合法的 JSON 或缺少 flutter 欄位', fix: `改為 { "flutter": "${expected.flutterVersion}" }，或刪除該檔。` })
    }
    else if (facts.fvmrc.version === expected.flutterVersion) {
      add({ level: 'ok', title: `.fvmrc ${facts.fvmrc.version}` })
    }
    else {
      add({ level: 'warn', title: `.fvmrc 是 ${facts.fvmrc.version}，框架基準是 ${expected.flutterVersion}`, fix: UPGRADE_HINT })
    }
  }

  // 4. npm 依賴
  const stale = facts.npmSpecs.filter(spec => spec.ref !== expected.shellRef)
  if (facts.npmSpecs.length === 0) {
    add({ level: 'ok', title: 'package.json 沒有以 github 指定版本的 Aqutter 依賴，略過' })
  }
  else if (stale.length === 0) {
    add({ level: 'ok', title: `npm 依賴 ref ${expected.shellRef}` })
  }
  else {
    add({
      level: 'warn',
      title: `npm 依賴 ref 與 CLI 不一致：${stale.map(spec => `${spec.name}#${spec.ref}`).join('、')}`,
      fix: `${UPGRADE_HINT}，再重新安裝依賴。`,
    })
  }

  // 5. lock 是否落後遠端
  if (facts.lock === null) {
    add({ level: 'warn', title: '沒有 pubspec.lock', fix: '在 App 目錄執行 `flutter pub get`。' })
  }
  else if (facts.remote === undefined) {
    add({ level: 'ok', title: '已略過 lock 與遠端的比對（--offline）' })
  }
  else {
    for (const name of LOCKED_PACKAGES) {
      const entry = facts.lock[name]
      if (!entry) {
        continue
      }
      const remote = facts.remote[`${entry.url}#${entry.ref}`]
      if (remote === undefined || remote === null) {
        add({ level: 'warn', title: `無法查詢 ${name} 的遠端 ${entry.ref}`, detail: '可能沒有網路或沒有存取權限。' })
      }
      else if (remote !== entry.resolvedRef) {
        add({
          level: 'warn',
          title: `${name} 的 lock 落後：鎖在 ${entry.resolvedRef.slice(0, 7)}，遠端 ${entry.ref} 已是 ${remote.slice(0, 7)}`,
          detail: '開發階段 tag 會隨 main 移動；lock 不會自動跟上。',
          fix: '在 App 目錄執行 `flutter pub upgrade aqutter aqutter_core`（`aqutter upgrade` 也會做）。',
        })
      }
      else {
        add({ level: 'ok', title: `${name} lock 與遠端 ${entry.ref} 一致（${remote.slice(0, 7)}）` })
      }
    }
  }
  return findings
}

// ---- 蒐集事實 ----

const readIfExists = (file: string): string | null => (existsSync(file) ? readFileSync(file, 'utf8') : null)

/** `flutter --version --machine` → frameworkVersion；失敗回 null。 */
export const detectFlutterVersion = (cwd: string): string | null => {
  const result = spawnSync('flutter', ['--version', '--machine'], { cwd, encoding: 'utf8', shell: IS_WIN })
  const out = result.stdout ?? ''
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return null
  }
  try {
    const version = (JSON.parse(out.slice(start, end + 1)) as { frameworkVersion?: string }).frameworkVersion
    return typeof version === 'string' ? version : null
  }
  catch {
    return null
  }
}

/** `git ls-remote` 查 ref 指向的 commit（附註 tag 取其指向的 commit）；失敗回 null。 */
export const remoteCommit = (url: string, ref: string): string | null => {
  const result = spawnSync('git', ['ls-remote', url, ref, `${ref}^{}`], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (result.status !== 0) {
    return null
  }
  const lines = (result.stdout ?? '').split('\n').filter(Boolean)
  const peeled = lines.find(line => line.endsWith('^{}'))
  const chosen = peeled ?? lines.find(line => /\trefs\/(tags|heads)\//.test(line)) ?? lines[0]
  return chosen ? chosen.split('\t')[0] : null
}

export const gatherFacts = (project: Project, offline: boolean): Facts => {
  const expected = expectedProfile()
  const pubspecText = readIfExists(join(project.appDir, 'pubspec.yaml'))
  const fvmrcText = readIfExists(join(project.appDir, '.fvmrc'))
  const packageText = readIfExists(join(project.root, 'package.json'))
  const lockText = readIfExists(join(project.appDir, 'pubspec.lock'))
  const lock = lockText === null ? null : parseLock(lockText)

  let remote: Record<string, string | null> | undefined
  if (!offline && lock !== null) {
    remote = {}
    for (const name of LOCKED_PACKAGES) {
      const entry = lock[name]
      if (entry) {
        remote[`${entry.url}#${entry.ref}`] = remoteCommit(entry.url, entry.ref)
      }
    }
  }
  return {
    expected,
    installedFlutter: detectFlutterVersion(project.appDir),
    pubspec: pubspecText === null ? null : parsePubspec(pubspecText),
    fvmrc: fvmrcText === null ? null : { version: parseFvmrc(fvmrcText) },
    npmSpecs: packageText === null ? [] : readNpmSpecs(packageText),
    lock,
    remote,
  }
}

const LABEL: Record<Level, string> = { ok: '[ok]  ', warn: '[警告]', error: '[錯誤]' }

export const runDoctor = async (project: Project, argv: string[]): Promise<void> => {
  const offline = argv.includes('--offline')
  console.log(`[${TAG}] 專案：${project.root}（CLI ${pkg.version}）`)
  const findings = diagnose(gatherFacts(project, offline))
  for (const finding of findings) {
    console.log(`${LABEL[finding.level]} ${finding.title}`)
    if (finding.detail) {
      console.log(`         ${finding.detail}`)
    }
    if (finding.fix && finding.level !== 'ok') {
      console.log(`         → ${finding.fix}`)
    }
  }
  const errors = findings.filter(f => f.level === 'error').length
  const warnings = findings.filter(f => f.level === 'warn').length
  console.log(`\n[${TAG}] ${errors} 個錯誤、${warnings} 個警告。`)
  if (errors > 0) {
    process.exit(1)
  }
}
