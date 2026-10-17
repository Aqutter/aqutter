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
  /** 覆寫開發伺服器指令（長駐），取代框架預設。樣板變數 `{envFile}`、`{port}`、`{host}`。 */
  devCommand?: string
  /** 覆寫產生靜態網頁的指令，取代框架預設。樣板變數 `{envFile}`。 */
  buildCommand?: string
  /** `buildCommand` 之前的準備指令（選填）。 */
  prepareCommand?: string
  /** 舊寫法：`framework` 為 `custom` 時的指令；等同 `devCommand` / `buildCommand` / `prepareCommand`。 */
  custom?: CustomWebCommands
  /** 內部欄位：設定檔是否明寫了 `framework`（沒寫時預設 vite，只是預設值，不代表產物目錄也是 dist）。 */
  frameworkExplicit?: boolean
}

/** 環境可覆蓋的網頁設定（疊在最上層 `web` 之上，欄位層級合併）。 */
export type WebOverrides = Partial<Pick<WebConfig, 'framework' | 'outputDir' | 'cleanDirs' | 'devCommand' | 'buildCommand' | 'prepareCommand'>>

/** 一個命名環境：env 檔、flavor、簽章，以及（選填）該環境專屬的網頁指令。 */
export interface EnvironmentConfig {
  /** env 檔路徑（相對專案根）；省略為 `<envDir>/.env.<名稱>`。 */
  envFile?: string
  /** 該環境對應的 Flutter flavor。 */
  flavor?: string
  /** 簽章設定檔路徑（相對 App 目錄），例如 `signing/signing.uat.json`。 */
  signing?: string
  /** 覆蓋最上層 `web` 的欄位（常用：`devCommand` / `buildCommand`）。 */
  web?: WebOverrides
}

/** 環境名：小寫字母開頭，其後為小寫字母、數字或連字號（與 `--x-env`、flavor 名一致）。 */
export const ENVIRONMENT_NAME = /^[a-z][a-z0-9-]*$/

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
  /** 命名環境；由 `aqutter env add/remove` 維護。沒有這個區塊的專案沿用檔名慣例（`--x-env`）。 */
  environments: Record<string, EnvironmentConfig>
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
  environments: {},
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
    web: { ...DEFAULT_CONFIG.web, ...(web as Partial<WebConfig>), frameworkExplicit: web.framework !== undefined },
    environments: isRecord(raw.environments) ? (raw.environments as Record<string, EnvironmentConfig>) : {},
    shell: { ...DEFAULT_CONFIG.shell, ...(shell as Partial<ShellConfig>) },
  }
  if (raw.environments !== undefined && !isRecord(raw.environments)) {
    throw new ConfigError('environments 必須是物件（名稱 → 設定）。')
  }
  if (!FRAMEWORKS.includes(merged.web.framework)) {
    throw new ConfigError(`web.framework 必須是 ${FRAMEWORKS.join(' / ')}（目前：${String(merged.web.framework)}）。`)
  }
  validateWebFramework(merged.web, 'web')
  validateWebCommands(merged.web, 'web')
  validateEnvironments(merged)
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

const WEB_COMMAND_KEYS = ['devCommand', 'buildCommand', 'prepareCommand'] as const

/** 網頁指令欄位必須是非空字串；`where` 用在錯誤訊息（`web` 或 `environments.<名稱>.web`）。 */
const validateWebCommands = (web: WebOverrides, where: string): void => {
  for (const key of WEB_COMMAND_KEYS) {
    const value = web[key]
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
      throw new ConfigError(`${where}.${key} 必須是非空字串。`)
    }
  }
  if (web.outputDir !== undefined && (typeof web.outputDir !== 'string' || web.outputDir === '')) {
    throw new ConfigError(`${where}.outputDir 必須是非空字串。`)
  }
  if (web.cleanDirs !== undefined && (!Array.isArray(web.cleanDirs) || web.cleanDirs.some(dir => typeof dir !== 'string' || dir === ''))) {
    throw new ConfigError(`${where}.cleanDirs 必須是非空字串陣列。`)
  }
  if (web.framework !== undefined && !FRAMEWORKS.includes(web.framework)) {
    throw new ConfigError(`${where}.framework 必須是 ${FRAMEWORKS.join(' / ')}（目前：${String(web.framework)}）。`)
  }
}

const validateEnvironments = (config: AqutterConfig): void => {
  for (const [name, environment] of Object.entries(config.environments)) {
    if (!ENVIRONMENT_NAME.test(name)) {
      throw new ConfigError(`environments 的名稱「${name}」不合法：須為小寫字母開頭，其後為小寫字母、數字或連字號。`)
    }
    if (!isRecord(environment)) {
      throw new ConfigError(`environments.${name} 必須是物件。`)
    }
    for (const key of ['envFile', 'flavor', 'signing'] as const) {
      const value = environment[key]
      if (value !== undefined && (typeof value !== 'string' || value === '')) {
        throw new ConfigError(`environments.${name}.${key} 必須是非空字串。`)
      }
    }
    if (environment.web !== undefined) {
      if (!isRecord(environment.web)) {
        throw new ConfigError(`environments.${name}.web 必須是物件。`)
      }
      validateWebCommands(environment.web, `environments.${name}.web`)
    }
  }
}

/**
 * 網頁設定能不能跑起來：沒有框架預設可依賴時（`custom`，或明寫了指令卻沒寫 `framework`）必須自己給齊
 * 開發指令、打包指令與靜態產物目錄——產物目錄不能靜默退回某個框架的預設值（例如 `dist`）。
 */
export const validateWebFramework = (web: WebConfig, where: string): void => {
  const dev = web.devCommand ?? web.custom?.dev
  const build = web.buildCommand ?? web.custom?.generate
  const usesCommands = web.devCommand !== undefined || web.buildCommand !== undefined || web.custom !== undefined
  const needsAll = web.framework === 'custom' || (usesCommands && web.frameworkExplicit === false)
  if (needsAll && (!dev || !build || !web.outputDir)) {
    throw new ConfigError(
      web.framework === 'custom'
        ? `${where}.framework 為 custom 時，必須提供開發指令（devCommand）、打包指令（buildCommand）與 outputDir（靜態產物目錄）。`
        : `${where} 用了 devCommand / buildCommand 卻沒有寫 framework：沒有框架預設可依賴，必須同時提供 devCommand、buildCommand 與 outputDir（或改寫 framework 取得預設值）。`,
    )
  }
}

/**
 * 某個環境實際生效的網頁設定：最上層 `web` 疊上環境的 `web`（欄位層級，環境優先）。
 * 沒有環境（或環境沒寫 `web`）時就是最上層的 `web`。
 */
export const effectiveWeb = (config: AqutterConfig, environmentName: string | null): WebConfig => {
  const overrides = environmentName ? config.environments[environmentName]?.web : undefined
  return overrides ? { ...config.web, ...overrides, frameworkExplicit: config.web.frameworkExplicit || overrides.framework !== undefined } : config.web
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
