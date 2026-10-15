import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const CONFIG_FILE = 'aqutter.config.json'

/** 內建的網頁框架轉接器；`custom` 由設定檔自帶指令。 */
export const FRAMEWORKS = ['nuxt', 'vite', 'next', 'custom'] as const
export type Framework = (typeof FRAMEWORKS)[number]

/** `custom` 框架的指令樣板：`{envFile}`、`{port}`、`{host}` 會被代換。 */
export interface CustomWebCommands {
  /** 開發伺服器指令（長駐）。 */
  dev: string
  /** 產出靜態網頁（種子 / 打包用）。 */
  generate: string
  /** 產生前的準備指令（選填）。 */
  prepare?: string
}

export interface WebConfig {
  framework: Framework
  /** 靜態產物目錄（相對專案根）；預設依框架而定。 */
  outputDir?: string
  /** 每次產生種子前清空的目錄（相對專案根）；預設依框架而定。 */
  cleanDirs?: string[]
  custom?: CustomWebCommands
}

export interface ShellConfig {
  /** 殼套件的 git ref（tag）；預設為本 CLI 版本。 */
  ref?: string
  /** 本機殼目錄（指向 aqutter repo 的 shell/）；設定後 App 以 path 依賴覆寫 git 依賴。 */
  path?: string
}

/** `aqutter-plugin.json`：plugin 套件根目錄的描述檔。 */
export interface PluginDescriptor {
  schema: 1
  /** plugin id；與 Dart 端 `AqutterPlugin.id`、網頁端 `callPlugin(id, …)` 一致。 */
  id: string
  dart: {
    /** Dart 套件名（plugin 套件根目錄的 pubspec name）。 */
    package: string
    /** 實作 `AqutterPlugin` 的類別名。 */
    class: string
    /** 匯入路徑；省略為 `package:<package>/<package>.dart`。 */
    import?: string
  }
}

/** 已安裝於專案的 plugin（寫入 aqutter.config.json）。 */
export interface PluginEntry {
  id: string
  /** npm 套件名（Dart 端原始碼隨該套件一起裝進 node_modules）。 */
  npm: string
  dart: PluginDescriptor['dart']
}

export interface AqutterConfig {
  /** 產生的 Flutter App 目錄（相對專案根）。 */
  appDir: string
  /** 放 env 檔的目錄（相對專案根）。 */
  envDir: string
  defaultDevEnv: string
  defaultProdEnv: string
  /** dev server 預設埠。 */
  defaultPort: number
  /** 打包產物的交付目錄（相對專案根）。 */
  artifactsDir: string
  /** 交付檔名前綴：`<name>_<env>[_<flavor>]_<version>.<ext>`。 */
  artifactName: string
  web: WebConfig
  shell: ShellConfig
  /** 已安裝的 plugin；由 `aqutter plugin add/remove` 維護。 */
  plugins: PluginEntry[]
}

export const DEFAULT_CONFIG: AqutterConfig = {
  appDir: 'aqutter',
  envDir: '.env',
  defaultDevEnv: '.env/.env.dev',
  defaultProdEnv: '.env/.env.prod',
  defaultPort: 3000,
  artifactsDir: 'artifacts',
  artifactName: 'app',
  web: { framework: 'vite' },
  shell: {},
  plugins: [],
}

/** 專案上下文：所有指令都吃這份，取代原先寫死的 ROOT / FLUTTER_HOST 常數。 */
export interface Project {
  root: string
  config: AqutterConfig
  /** Flutter App 目錄（絕對路徑）。 */
  appDir: string
  artifactsDir: string
  seedDir: string
  seedBundle: string
  seedVersion: string
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 由 cwd 往上找含 `aqutter.config.json` 的目錄；找不到回 null。 */
export const findProjectRoot = (cwd: string): string | null => {
  let dir = resolve(cwd)
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return null
    }
    dir = parent
  }
}

/** 合併使用者設定與預設值並驗證；非法值拋 [ConfigError]，不靜默退回預設。 */
export const parseConfig = (raw: unknown): AqutterConfig => {
  if (!isRecord(raw)) {
    throw new ConfigError(`${CONFIG_FILE} 必須是 JSON 物件。`)
  }
  const web = isRecord(raw.web) ? raw.web : {}
  const shell = isRecord(raw.shell) ? raw.shell : {}
  const merged: AqutterConfig = {
    ...DEFAULT_CONFIG,
    ...(raw as Partial<AqutterConfig>),
    web: { ...DEFAULT_CONFIG.web, ...(web as Partial<WebConfig>) },
    shell: { ...DEFAULT_CONFIG.shell, ...(shell as Partial<ShellConfig>) },
  }
  if (!FRAMEWORKS.includes(merged.web.framework)) {
    throw new ConfigError(`web.framework 必須是 ${FRAMEWORKS.join(' / ')}（目前：${String(merged.web.framework)}）。`)
  }
  if (merged.web.framework === 'custom' && !merged.web.custom?.dev) {
    throw new ConfigError('web.framework 為 custom 時，必須提供 web.custom.dev 與 web.custom.generate，且 web.outputDir 需指向靜態產物目錄。')
  }
  if (merged.web.framework === 'custom' && (!merged.web.custom?.generate || !merged.web.outputDir)) {
    throw new ConfigError('web.framework 為 custom 時，必須提供 web.custom.generate 與 web.outputDir。')
  }
  if (!Array.isArray(merged.plugins)) {
    throw new ConfigError('plugins 必須是陣列。')
  }
  if (!Number.isInteger(merged.defaultPort) || merged.defaultPort < 1 || merged.defaultPort > 65535) {
    throw new ConfigError(`defaultPort 必須是 1–65535 的整數（目前：${String(merged.defaultPort)}）。`)
  }
  for (const key of ['appDir', 'envDir', 'defaultDevEnv', 'defaultProdEnv', 'artifactsDir', 'artifactName'] as const) {
    if (typeof merged[key] !== 'string' || merged[key] === '') {
      throw new ConfigError(`${key} 必須是非空字串。`)
    }
  }
  return merged
}

export const createProject = (root: string, config: AqutterConfig): Project => {
  const appDir = resolve(root, config.appDir)
  const seedDir = join(appDir, 'assets', 'seed')
  return {
    root,
    config,
    appDir,
    artifactsDir: resolve(root, config.artifactsDir),
    seedDir,
    seedBundle: join(seedDir, 'web-bundle.zip'),
    seedVersion: join(seedDir, 'seed-version.json'),
  }
}

/** 載入目前專案；找不到設定檔拋 [ConfigError] 並提示 `aqutter init`。 */
export const loadProject = (cwd: string): Project => {
  const root = findProjectRoot(cwd)
  if (root === null) {
    throw new ConfigError(`找不到 ${CONFIG_FILE}。請在專案根目錄執行 \`aqutter init\`。`)
  }
  const file = join(root, CONFIG_FILE)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new ConfigError(`${CONFIG_FILE} 不是合法的 JSON：${(error as Error).message}`)
  }
  return createProject(root, parseConfig(raw))
}

/** 把相對專案根的路徑轉成絕對路徑（已是絕對路徑則原樣回傳）。 */
export const fromRoot = (project: Project, path: string): string => (isAbsolute(path) ? path : join(project.root, path))
