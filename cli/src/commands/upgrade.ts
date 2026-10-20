// aqutter upgrade：把專案對齊到「這支 CLI 所代表的框架版本」。
//
// 會改的（只改需要改的那一行，保留格式）：
//   - <appDir>/pubspec.yaml ：environment.sdk / environment.flutter、殼依賴的 git ref（path 依賴不動）
//   - <appDir>/.fvmrc       ：Flutter 版本——只在專案已有這個檔案時才更新；FVM 是選配，不替專案建立
//   - package.json          ：@aqutter/aqutter、@aqutter/aqutter-cli 的 github 依賴 ref
// 然後在 App 目錄執行 `flutter pub upgrade aqutter aqutter_core`，讓 lock 跟上（開發階段 tag 會移動）。
// 不會動 `aqutter init` 當初展開的原生檔案（android/、ios/、windows/…）與 lib/：這些是專案自己的。
//
// 升級流程：先把 package.json 的 CLI 依賴升到新版並安裝，再用新版 CLI 執行 `aqutter upgrade`。
//
// 用法：aqutter upgrade [--dry-run] [--skip-pub]
//   --dry-run  : 只列出會改什麼，不寫檔、不執行 flutter
//   --skip-pub : 只改檔案，不執行 flutter pub upgrade

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Project } from '../config.ts'
import { IS_WIN } from '../shared.ts'
import { LOCKED_PACKAGES, parsePubspec, rewriteFvmrc, rewritePackageJson, rewritePubspec } from '../versioning.ts'
import { expectedProfile } from './doctor.ts'
import type { ExpectedProfile } from './doctor.ts'

const TAG = 'upgrade'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

export interface UpgradeInput {
  pubspec: string
  /** `.fvmrc` 原內容；檔案不存在為 null。 */
  fvmrc: string | null
  /** package.json 原內容；檔案不存在為 null。 */
  packageJson: string | null
  /** 殼依賴由設定檔指向本機路徑時不動 ref。 */
  keepShellRef: boolean
}

export interface UpgradePlan {
  pubspec: { text: string, changes: string[] }
  /** null：專案沒有 .fvmrc（FVM 是選配，不替專案建立）；'invalid'：不是合法 JSON，不覆寫。 */
  fvmrc: { text: string, changed: boolean } | 'invalid' | null
  packageJson: { text: string, changes: string[] } | null
  /** 殼依賴是 git 時才需要更新 lock。 */
  needsPubUpgrade: boolean
}

export const planUpgrade = (input: UpgradeInput, expected: ExpectedProfile): UpgradePlan => {
  const info = parsePubspec(input.pubspec)
  const shellIsGit = info.shell?.kind === 'git'
  const pubspec = rewritePubspec(input.pubspec, {
    sdk: expected.sdk,
    flutter: expected.flutter,
    shellRef: shellIsGit && !input.keepShellRef ? expected.shellRef : null,
  })
  const fvmrc = input.fvmrc === null ? null : (rewriteFvmrc(input.fvmrc, expected.flutterVersion) ?? 'invalid')
  const packageJson = input.packageJson === null ? null : rewritePackageJson(input.packageJson, expected.shellRef)
  return { pubspec, fvmrc, packageJson, needsPubUpgrade: shellIsGit }
}

const installCommand = (root: string): string => {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) {
    return 'pnpm install'
  }
  if (existsSync(join(root, 'yarn.lock'))) {
    return 'yarn install'
  }
  return 'npm install'
}

export const runUpgrade = async (project: Project, argv: string[]): Promise<void> => {
  const dryRun = argv.includes('--dry-run')
  const skipPub = argv.includes('--skip-pub')
  const expected = expectedProfile()

  const pubspecFile = join(project.appDir, 'pubspec.yaml')
  const fvmrcFile = join(project.appDir, '.fvmrc')
  const packageFile = join(project.root, 'package.json')
  if (!existsSync(pubspecFile)) {
    return fail(`找不到 ${pubspecFile}。請確認 aqutter.config.json 的 appDir。`)
  }
  const originalPubspec = readFileSync(pubspecFile, 'utf8')
  const originalPackage = existsSync(packageFile) ? readFileSync(packageFile, 'utf8') : null

  const plan = planUpgrade(
    {
      pubspec: originalPubspec,
      fvmrc: existsSync(fvmrcFile) ? readFileSync(fvmrcFile, 'utf8') : null,
      packageJson: originalPackage,
      keepShellRef: project.config.shell.path !== undefined,
    },
    expected,
  )

  console.log(`[${TAG}] 對齊到 Flutter ${expected.flutterVersion}、殼 ref ${expected.shellRef}${dryRun ? '（dry-run，不寫檔）' : ''}`)

  let changed = false
  const report = (file: string, changes: string[]): void => {
    for (const change of changes) {
      console.log(`  ${file}  ${change}`)
    }
    changed = changed || changes.length > 0
  }

  report('pubspec.yaml', plan.pubspec.changes)
  if (plan.pubspec.changes.length > 0 && !dryRun) {
    writeFileSync(pubspecFile, plan.pubspec.text)
  }

  if (plan.fvmrc === 'invalid') {
    console.warn(`  .fvmrc  不是合法 JSON，已略過（請手動修正：{ "flutter": "${expected.flutterVersion}" }，或刪除該檔）`)
  }
  else if (plan.fvmrc !== null && plan.fvmrc.changed) {
    report('.fvmrc', [`flutter → ${expected.flutterVersion}`])
    if (!dryRun) {
      writeFileSync(fvmrcFile, plan.fvmrc.text)
    }
  }

  const npmChanged = plan.packageJson !== null && plan.packageJson.changes.length > 0
  if (plan.packageJson !== null) {
    report('package.json', plan.packageJson.changes)
    if (npmChanged && !dryRun) {
      writeFileSync(packageFile, plan.packageJson.text)
    }
  }

  if (!changed) {
    console.log(`[${TAG}] 檔案已是最新，不需要修改。`)
  }

  if (!dryRun && !skipPub && plan.needsPubUpgrade) {
    console.log(`\n[${TAG}] flutter pub upgrade ${LOCKED_PACKAGES.join(' ')}（讓 pubspec.lock 跟上）`)
    const result = spawnSync('flutter', ['pub', 'upgrade', ...LOCKED_PACKAGES], {
      cwd: project.appDir,
      stdio: 'inherit',
      shell: IS_WIN,
    })
    if (result.status !== 0) {
      return fail('flutter pub upgrade 失敗；pubspec / .fvmrc / package.json 已更新，請排除問題後在 App 目錄重跑該指令。')
    }
  }

  console.log(`\n[${TAG}] 完成。後續：`)
  if (npmChanged && !dryRun) {
    console.log(`  ${installCommand(project.root)}    # package.json 的 Aqutter 依賴已改，重新安裝`)
  }
  console.log('  aqutter doctor    # 確認一致')
  console.log('  注意：android/、ios/、windows/ 等原生檔案是 init 時展開、屬於專案自己的，本指令不會改動。')
}
