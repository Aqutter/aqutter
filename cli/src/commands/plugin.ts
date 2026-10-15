// aqutter plugin：第三方 plugin 的建立與安裝。
//
//   aqutter plugin create <id> [--npm-name=<名>] [--dir=<目錄>] [--shell-ref=<tag>] [--shell-path=<殼目錄>]
//       由範本產生 plugin 專案（同時是 npm 套件與 Dart 套件）。
//   aqutter plugin add <來源> [--no-install]
//       以套件管理器安裝 npm 套件（來源可為套件名、github:owner/repo、file:路徑），讀 aqutter-plugin.json，
//       登記到 aqutter.config.json，並同步 pubspec 依賴與 lib/aqutter_plugins.dart。
//   aqutter plugin remove <id>
//   aqutter plugin sync        依 aqutter.config.json 重寫 pubspec 與註冊清單。
//   aqutter plugin list

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

import pkg from '../../package.json'
import { loadProject } from '../config.ts'
import { IS_WIN, parseArgs } from '../shared.ts'
import { findTemplateRoot, renderTree } from '../template.ts'
import type { TemplateVariables } from '../template.ts'
import { PLUGIN_ID_PATTERN, readInstalledDescriptor, syncPlugins, updateConfigPlugins } from '../plugins.ts'
import { usePathDependency } from './init.ts'

const TAG = 'plugin'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** `native-view` → `NativeView`。 */
export const toClassName = (id: string): string => id.split('-').map(capitalize).join('')

/** `native-view` → `native_view`。 */
export const toSnake = (id: string): string => id.replace(/-/g, '_')

type PackageManager = 'pnpm' | 'yarn' | 'npm'

const detectPackageManager = (root: string): PackageManager => {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (existsSync(join(root, 'yarn.lock'))) {
    return 'yarn'
  }
  return 'npm'
}

const runPm = (pm: PackageManager, args: string[], cwd: string): void => {
  console.log(`[${TAG}] ${pm} ${args.join(' ')}`)
  const result = spawnSync(pm, args, { cwd, stdio: 'inherit', shell: IS_WIN })
  if (result.status !== 0) {
    fail(`${pm} ${args.join(' ')} 失敗（exit ${result.status ?? 'signal'}）。`)
  }
}

const readDependencyNames = (root: string): Set<string> => {
  const file = join(root, 'package.json')
  if (!existsSync(file)) {
    return new Set()
  }
  const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string> | undefined>
  return new Set([...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {})])
}

const create = (cwd: string, argv: string[]): void => {
  const { positional, flags } = parseArgs(argv)
  const id = positional[0]
  if (!id || !PLUGIN_ID_PATTERN.test(id)) {
    return fail(`用法：aqutter plugin create <id>（id 為小寫字母開頭、僅含小寫字母 / 數字 / 連字號，例如 haptics）`)
  }
  const dirName = flags.dir ?? `aqutter-plugin-${id}`
  const target = resolve(cwd, dirName)
  if (existsSync(target)) {
    return fail(`${dirName} 已存在。`)
  }
  const variables: TemplateVariables = {
    id,
    idSnake: toSnake(id),
    className: toClassName(id),
    dartPackage: `aqutter_plugin_${toSnake(id)}`,
    npmName: flags['npm-name'] ?? `aqutter-plugin-${id}`,
    shellRef: flags['shell-ref'] ?? pkg.version,
    clientRef: flags['shell-ref'] ?? pkg.version,
  }
  const { written } = renderTree(join(findTemplateRoot(), 'plugin'), target, variables)
  if (flags['shell-path']) {
    const shellFlag = flags['shell-path']
    const rel = isAbsolute(shellFlag) ? shellFlag : relative(target, resolve(cwd, shellFlag)).split('\\').join('/')
    const pubspec = join(target, 'pubspec.yaml')
    writeFileSync(pubspec, usePathDependency(readFileSync(pubspec, 'utf8'), rel))
  }
  console.log(`[${TAG}] 已建立 ${dirName}/（${written.length} 個檔案）`)
  console.log('\n下一步：')
  console.log(`  cd ${dirName} && pnpm install && flutter pub get && flutter test`)
  console.log(`  之後在 App 專案：aqutter plugin add file:../${dirName}`)
}

const add = (cwd: string, argv: string[]): void => {
  const { positional } = parseArgs(argv.filter(arg => arg !== '--no-install'))
  const source = positional[0]
  if (!source) {
    return fail('用法：aqutter plugin add <來源>（套件名、github:owner/repo 或 file:路徑）')
  }
  const project = loadProject(cwd)
  const pm = detectPackageManager(project.root)
  const before = readDependencyNames(project.root)

  if (!argv.includes('--no-install')) {
    runPm(pm, pm === 'npm' ? ['install', source] : ['add', source], project.root)
  }

  const after = readDependencyNames(project.root)
  const added = [...after].filter(name => !before.has(name))
  const npmName = added[0] ?? (before.has(source) ? source : undefined)
  if (!npmName) {
    return fail('無法判斷安裝的 npm 套件名；請確認安裝成功（或套件已存在時，用套件名當來源）。')
  }

  const descriptor = readInstalledDescriptor(project.root, npmName)
  if (project.config.plugins.some(entry => entry.id === descriptor.id && entry.npm !== npmName)) {
    return fail(`plugin id「${descriptor.id}」已被另一個套件使用。`)
  }
  updateConfigPlugins(project, plugins => [
    ...plugins.filter(entry => entry.id !== descriptor.id),
    { id: descriptor.id, npm: npmName, dart: descriptor.dart },
  ].sort((a, b) => a.id.localeCompare(b.id)))
  console.log(`[${TAG}] 已加入 plugin「${descriptor.id}」（${npmName}）。請在 ${project.config.appDir}/ 執行 flutter pub get。`)
}

const remove = (cwd: string, argv: string[]): void => {
  const id = argv[0]
  if (!id) {
    return fail('用法：aqutter plugin remove <id>')
  }
  const project = loadProject(cwd)
  const entry = project.config.plugins.find(plugin => plugin.id === id)
  if (!entry) {
    return fail(`專案內沒有 plugin「${id}」。`)
  }
  updateConfigPlugins(project, plugins => plugins.filter(plugin => plugin.id !== id))
  const pm = detectPackageManager(project.root)
  runPm(pm, ['remove', entry.npm], project.root)
  console.log(`[${TAG}] 已移除 plugin「${id}」。`)
}

export const runPlugin = async (cwd: string, argv: string[]): Promise<void> => {
  const [sub, ...rest] = argv
  switch (sub) {
    case 'create':
      return create(cwd, rest)
    case 'add':
      return add(cwd, rest)
    case 'remove':
      return remove(cwd, rest)
    case 'sync': {
      const project = loadProject(cwd)
      syncPlugins(project)
      console.log(`[${TAG}] 已同步 ${project.config.plugins.length} 個 plugin。`)
      return
    }
    case 'list': {
      const project = loadProject(cwd)
      for (const entry of project.config.plugins) {
        console.log(`${entry.id}\t${entry.npm}\t${entry.dart.package}`)
      }
      return
    }
    default:
      return fail('用法：aqutter plugin <create|add|remove|sync|list>')
  }
}
