// plugin 的專案端整合：把 aqutter.config.json 的 plugins 同步成 App 的 pubspec 依賴與 Dart 註冊清單。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CONFIG_FILE } from './config.ts'
import type { PluginDescriptor, PluginEntry, Project } from './config.ts'

export const PLUGIN_DESCRIPTOR_FILE = 'aqutter-plugin.json'

/** 與 Dart 端 `aqutterPluginIdPattern` 同一條規則。 */
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/

export const PUBSPEC_BEGIN = '  # aqutter-plugins:begin（由 `aqutter plugin` 維護，請勿手改）'
export const PUBSPEC_END = '  # aqutter-plugins:end'
export const PLUGINS_DART_FILE = 'aqutter_plugins.dart'

const DART_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*$/
const DART_CLASS_PATTERN = /^[A-Z][A-Za-z0-9_]*$/

/** 驗證並回傳 plugin 描述檔；不合法拋錯並指出欄位。 */
export const parseDescriptor = (raw: unknown, source: string): PluginDescriptor => {
  const fail = (reason: string): never => {
    throw new Error(`${source} 不合法：${reason}`)
  }
  if (typeof raw !== 'object' || raw === null) {
    return fail('必須是 JSON 物件')
  }
  const value = raw as Record<string, unknown>
  if (value.schema !== 1) {
    fail('schema 必須為 1')
  }
  if (typeof value.id !== 'string' || !PLUGIN_ID_PATTERN.test(value.id)) {
    fail(`id 必須符合 ${PLUGIN_ID_PATTERN}`)
  }
  const dart = value.dart as Record<string, unknown> | undefined
  if (typeof dart !== 'object' || dart === null) {
    return fail('缺少 dart 區塊')
  }
  if (typeof dart.package !== 'string' || !DART_PACKAGE_PATTERN.test(dart.package)) {
    fail('dart.package 必須是 Dart 套件名（小寫 snake_case）')
  }
  if (typeof dart.class !== 'string' || !DART_CLASS_PATTERN.test(dart.class)) {
    fail('dart.class 必須是 Dart 類別名')
  }
  if (dart.import !== undefined && typeof dart.import !== 'string') {
    fail('dart.import 必須是字串')
  }
  return {
    schema: 1,
    id: value.id as string,
    dart: {
      package: dart.package as string,
      class: dart.class as string,
      ...(dart.import === undefined ? {} : { import: dart.import as string }),
    },
  }
}

const importOf = (entry: PluginEntry): string => entry.dart.import ?? `package:${entry.dart.package}/${entry.dart.package}.dart`

/** 產生 `lib/aqutter_plugins.dart`。 */
export const renderPluginsDart = (plugins: PluginEntry[]): string => {
  const imports = [...new Set(plugins.map(importOf))].sort()
  const lines = [
    '// 由 `aqutter plugin` 產生，請勿手改；要增減 plugin 請用 `aqutter plugin add/remove`。',
    '// ignore_for_file: directives_ordering',
    "import 'package:aqutter/aqutter.dart';",
    ...imports.map(path => `import '${path}';`),
    '',
    '/// 傳給 `runAqutter(plugins: aqutterPlugins)`。',
    plugins.length === 0
      ? 'final List<AqutterPlugin> aqutterPlugins = <AqutterPlugin>[];'
      : `final List<AqutterPlugin> aqutterPlugins = <AqutterPlugin>[\n${plugins.map(entry => `  ${entry.dart.class}(),`).join('\n')}\n];`,
    '',
  ]
  return lines.join('\n')
}

/** pubspec 的受管區塊內容（不含標記行）。 */
export const renderPubspecBlock = (plugins: PluginEntry[], projectRoot: string, appDir: string): string[] => {
  return plugins.flatMap((entry) => {
    const path = relative(appDir, join(projectRoot, 'node_modules', entry.npm)).split('\\').join('/')
    return [`  ${entry.dart.package}:`, `    path: ${path}`]
  })
}

/** 把受管區塊寫回 pubspec；沒有標記時拋錯（範本以外的 pubspec 需手動補標記）。 */
export const applyPubspecBlock = (pubspec: string, block: string[]): string => {
  const begin = pubspec.indexOf(PUBSPEC_BEGIN)
  const end = pubspec.indexOf(PUBSPEC_END)
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`pubspec.yaml 缺少 plugin 受管區塊標記（${PUBSPEC_BEGIN.trim()} … ${PUBSPEC_END.trim()}），請在 dependencies: 內補上這兩行。`)
  }
  const middle = block.length === 0 ? '' : `${block.join('\n')}\n`
  return `${pubspec.slice(0, begin)}${PUBSPEC_BEGIN}\n${middle}${pubspec.slice(end)}`
}

/** 依 config 的 plugins 重寫 pubspec 與 `lib/aqutter_plugins.dart`。 */
export const syncPlugins = (project: Project): void => {
  const plugins = project.config.plugins
  const pubspecPath = join(project.appDir, 'pubspec.yaml')
  const original = readFileSync(pubspecPath, 'utf8')
  const next = applyPubspecBlock(original, renderPubspecBlock(plugins, project.root, project.appDir))
  if (next !== original) {
    writeFileSync(pubspecPath, next)
  }
  writeFileSync(join(project.appDir, 'lib', PLUGINS_DART_FILE), renderPluginsDart(plugins))
}

/**
 * 套用新的 plugin 清單：先同步 pubspec 與註冊清單，成功後才寫回 aqutter.config.json，
 * 避免同步失敗時留下「config 說有、pubspec 沒有」的半套狀態。其餘設定內容原樣保留。
 */
export const updateConfigPlugins = (project: Project, update: (plugins: PluginEntry[]) => PluginEntry[]): void => {
  const previous = project.config.plugins
  const next = update([...previous])
  project.config.plugins = next
  try {
    syncPlugins(project)
  }
  catch (error) {
    project.config.plugins = previous
    throw error
  }
  const file = join(project.root, CONFIG_FILE)
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  if (next.length === 0) {
    delete raw.plugins
  }
  else {
    raw.plugins = next
  }
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
}

/** 讀已安裝 npm 套件內的描述檔。 */
export const readInstalledDescriptor = (projectRoot: string, npmName: string): PluginDescriptor => {
  const file = join(projectRoot, 'node_modules', npmName, PLUGIN_DESCRIPTOR_FILE)
  if (!existsSync(file)) {
    throw new Error(`${npmName} 內找不到 ${PLUGIN_DESCRIPTOR_FILE}，它不是 Aqutter plugin。`)
  }
  return parseDescriptor(JSON.parse(readFileSync(file, 'utf8')), `${npmName}/${PLUGIN_DESCRIPTOR_FILE}`)
}
