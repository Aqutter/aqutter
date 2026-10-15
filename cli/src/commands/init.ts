// aqutter init：在既有網頁專案內加入 Aqutter。
//   1. 寫 aqutter.config.json
//   2. 由範本展開 Flutter App 目錄（預設 aqutter/）
//   3. 補 env 範例與 .gitignore 條目
// 重跑安全：已存在的檔案一律不覆寫（除非 --force）。
//
// 用法：aqutter init [--name=<snake_case>] [--org=<com.example>] [--display-name=<名稱>]
//                    [--framework=nuxt|vite|next|custom] [--app-dir=<dir>] [--shell-path=<殼目錄>] [--shell-ref=<tag>] [--force]

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

import pkg from '../../package.json'
import { CONFIG_FILE, DEFAULT_CONFIG, FRAMEWORKS } from '../config.ts'
import type { AqutterConfig, Framework } from '../config.ts'
import { parseArgs } from '../shared.ts'
import { findTemplateRoot, renderTree } from '../template.ts'
import type { TemplateVariables } from '../template.ts'

const TAG = 'init'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

/** 專案名 → Dart 套件名（snake_case，小寫字母開頭）。 */
export const toAppName = (raw: string): string => {
  const cleaned = raw.replace(/^@[^/]+\//, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  const name = /^[a-z]/.test(cleaned) ? cleaned : `app_${cleaned}`
  return name === 'app_' ? 'app' : name
}

export const toCamel = (snake: string): string => snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

export const toDisplayName = (snake: string): string => snake.split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

/** 由專案內的設定檔推測網頁框架。 */
export const detectFramework = (root: string): Framework | null => {
  const has = (prefix: string): boolean => ['ts', 'js', 'mjs', 'mts'].some(ext => existsSync(join(root, `${prefix}.config.${ext}`)))
  if (has('nuxt')) {
    return 'nuxt'
  }
  if (has('next')) {
    return 'next'
  }
  if (has('vite')) {
    return 'vite'
  }
  return null
}

const GITIGNORE_ENTRIES = [
  '# Aqutter',
  '/artifacts/',
  '.env/.env.*',
  '!.env/.env.example',
]

const appendGitignore = (root: string, appDir: string): void => {
  const file = join(root, '.gitignore')
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const wanted = [
    ...GITIGNORE_ENTRIES,
    `/${appDir}/assets/seed/*`,
    `!/${appDir}/assets/seed/.gitkeep`,
    `/${appDir}/signing/signing.*.json`,
    `!/${appDir}/signing/signing.example.json`,
  ]
  const missing = wanted.filter(line => line.startsWith('#') ? !current.includes(line) : !current.split('\n').includes(line))
  if (missing.length === 0) {
    return
  }
  appendFileSync(file, `${current === '' || current.endsWith('\n') ? '' : '\n'}\n${missing.join('\n')}\n`)
}

/** 把殼依賴由 git 改指向本機路徑（開發殼本身時用）。 */
export const usePathDependency = (pubspec: string, shellPath: string): string => {
  return pubspec.replace(/ {2}aqutter:\n {4}git:\n(?: {6}.*\n)+/, `  aqutter:\n    path: ${shellPath}\n`)
}

export const runInit = async (cwd: string, argv: string[]): Promise<void> => {
  const { flags } = parseArgs(argv.filter(arg => arg !== '--force'))
  const force = argv.includes('--force')
  const root = resolve(cwd)

  let packageName = basename(root)
  const packageJson = join(root, 'package.json')
  if (existsSync(packageJson)) {
    try {
      packageName = (JSON.parse(readFileSync(packageJson, 'utf8')) as { name?: string }).name ?? packageName
    }
    catch {
      // package.json 壞掉不影響 init，退回資料夾名
    }
  }

  const appName = toAppName(flags.name ?? packageName)
  const orgId = flags.org ?? 'com.example'
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(orgId)) {
    fail(`--org 需為小寫的反向網域（例如 com.example），收到「${orgId}」。`)
  }
  if (!/^[a-z][a-z0-9_]*$/.test(appName)) {
    fail(`--name 需為小寫 snake_case（Dart 套件名），收到「${appName}」。`)
  }
  const framework = (flags.framework ?? detectFramework(root) ?? 'vite') as Framework
  if (!FRAMEWORKS.includes(framework)) {
    fail(`--framework 需為 ${FRAMEWORKS.join(' / ')}，收到「${framework}」。`)
  }
  const appDirName = flags['app-dir'] ?? DEFAULT_CONFIG.appDir
  const appDir = resolve(root, appDirName)
  const shellRef = flags['shell-ref'] ?? pkg.version

  const configFile = join(root, CONFIG_FILE)
  if (existsSync(configFile) && !force) {
    fail(`${CONFIG_FILE} 已存在。要重新展開請加 --force。`)
  }

  const config: Partial<AqutterConfig> & { web: { framework: Framework } } = {
    ...(appDirName === DEFAULT_CONFIG.appDir ? {} : { appDir: appDirName }),
    web: { framework },
  }
  const shellConfig = flags['shell-path'] ? { path: flags['shell-path'] } : undefined
  writeFileSync(configFile, `${JSON.stringify(shellConfig ? { ...config, shell: shellConfig } : config, null, 2)}\n`)
  console.log(`[${TAG}] 寫入 ${CONFIG_FILE}（framework=${framework}）`)

  const variables: TemplateVariables = {
    appName,
    appNameCamel: toCamel(appName),
    orgId,
    orgPath: orgId.split('.').join('/'),
    displayName: flags['display-name'] ?? toDisplayName(appName),
    shellRef,
  }
  const templateRoot = findTemplateRoot()
  const { written, skipped } = renderTree(join(templateRoot, 'app'), appDir, variables, { overwrite: force })
  console.log(`[${TAG}] 展開 ${relative(root, appDir) || '.'}/（${written.length} 個檔案，略過已存在 ${skipped.length} 個）`)

  if (flags['shell-path']) {
    const pubspecPath = join(appDir, 'pubspec.yaml')
    const shellFlag = flags['shell-path']
    const rel = isAbsolute(shellFlag) ? shellFlag : relative(appDir, resolve(root, shellFlag)).split('\\').join('/')
    writeFileSync(pubspecPath, usePathDependency(readFileSync(pubspecPath, 'utf8'), rel))
    console.log(`[${TAG}] 殼依賴改指向本機路徑：${rel}`)
  }

  const envDir = join(root, DEFAULT_CONFIG.envDir)
  mkdirSync(envDir, { recursive: true })
  const envResult = renderTree(join(templateRoot, 'env'), envDir, variables)
  if (envResult.written.length > 0) {
    console.log(`[${TAG}] 寫入 ${DEFAULT_CONFIG.envDir}/.env.example；請複製為 ${DEFAULT_CONFIG.envDir}/.env.dev 並填值。`)
  }
  appendGitignore(root, appDirName)

  console.log(`\n[${TAG}] 完成。下一步：`)
  console.log(`  cp ${DEFAULT_CONFIG.envDir}/.env.example ${DEFAULT_CONFIG.envDir}/.env.dev`)
  console.log(`  cd ${appDirName} && flutter pub get && cd ..`)
  console.log('  aqutter dev macos')
}
