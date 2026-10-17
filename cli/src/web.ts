// 網頁框架轉接器：把「怎麼起 dev server、怎麼產生靜態網頁」收攏成一處，
// 其餘指令（dev / seed / build）只認這個介面，不認任何特定框架。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Project, WebConfig } from './config.ts'
import { validateWebFramework } from './config.ts'
import { IS_WIN } from './shared.ts'

export interface Invocation {
  command: string
  args: string[]
  /** 額外環境變數（疊在 process.env 之上）。 */
  env?: NodeJS.ProcessEnv
}

export interface DevContext {
  envFile: string
  port: number
  /** iOS 實機 / 區網時的綁定位址；未指定為 undefined。 */
  devHost?: string
}

export interface GenerateContext {
  envFile: string
}

export interface WebStep extends Invocation {
  label: string
}

export interface WebAdapter {
  /** 靜態產物目錄（相對專案根）。 */
  outputDir: string
  /** 產生種子前清空的目錄（相對專案根）。 */
  cleanDirs: string[]
  /** 長駐的 dev server 指令。 */
  dev: (context: DevContext) => Invocation
  /** 產生靜態網頁所需的依序步驟。 */
  generate: (context: GenerateContext) => WebStep[]
}

/** 解析 dotenv 檔為物件：支援 `KEY=VALUE`、`export KEY=VALUE`、單雙引號、`#` 註解。 */
export const parseEnvFile = (path: string): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) {
      continue
    }
    let value = match[2]
    const quote = value[0]
    if ((quote === '"' || quote === '\'') && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '')
    }
    result[match[1]] = value
  }
  return result
}

/** 依 lockfile 判斷套件管理器，回傳「執行本機 bin」的前綴。 */
export const execPrefix = (project: Project): Invocation => {
  if (existsSync(join(project.root, 'pnpm-lock.yaml'))) {
    return { command: 'pnpm', args: ['exec'] }
  }
  if (existsSync(join(project.root, 'yarn.lock'))) {
    return { command: 'yarn', args: [] }
  }
  return { command: 'npx', args: ['--no-install'] }
}

const withExec = (project: Project, bin: string, args: string[], env?: NodeJS.ProcessEnv): Invocation => {
  const prefix = execPrefix(project)
  return { command: prefix.command, args: [...prefix.args, bin, ...args], env }
}

/** 把 env 檔的內容注入子行程環境（不原生支援 `--dotenv` 的框架用）。 */
const envFromFile = (project: Project, envFile: string): NodeJS.ProcessEnv => parseEnvFile(join(project.root, envFile))

const shellInvocation = (command: string): Invocation => {
  return IS_WIN ? { command: 'cmd', args: ['/c', command] } : { command: 'sh', args: ['-c', command] }
}

const fill = (template: string, values: Record<string, string>): string => {
  return template.replace(/\{(envFile|port|host)\}/g, (_, key: string) => values[key] ?? '')
}

const nuxtAdapter = (project: Project, web: WebConfig): WebAdapter => ({
  outputDir: web.outputDir ?? '.output/public',
  cleanDirs: web.cleanDirs ?? ['.nuxt', '.output'],
  // nuxi 需以等號綁值（`--dotenv=<file>`），否則值會被當成 rootDir 位置參數；
  // `--host` 的值是選填的、會吃掉緊接其後的參數，故必須放在最後。
  dev: ({ envFile, port, devHost }) => withExec(project, 'nuxt', ['dev', `--dotenv=${envFile}`, `--port=${port}`, '--host'], {
    ...(devHost ? { DEV_HOST: devHost } : {}),
    // 設定檔讀不到 CLI 參數，故以 env 交棒——CSP 的 connect-src 與 HMR 的 websocket 埠都要跟著動
    DEV_PORT: String(port),
  }),
  generate: ({ envFile }) => [
    // 清掉 .nuxt 後 `nuxt generate` 不會自行補回 .nuxt/tsconfig.json，需先 prepare
    { label: 'nuxt prepare', ...withExec(project, 'nuxt', ['prepare']) },
    { label: 'nuxt generate', ...withExec(project, 'nuxt', ['generate', `--dotenv=${envFile}`]) },
  ],
})

const viteAdapter = (project: Project, web: WebConfig): WebAdapter => ({
  outputDir: web.outputDir ?? 'dist',
  cleanDirs: web.cleanDirs ?? ['dist'],
  dev: ({ envFile, port, devHost }) => withExec(project, 'vite', ['--port', String(port), '--strictPort', '--host'], {
    ...envFromFile(project, envFile),
    ...(devHost ? { DEV_HOST: devHost } : {}),
    DEV_PORT: String(port),
  }),
  generate: ({ envFile }) => [
    { label: 'vite build', ...withExec(project, 'vite', ['build'], envFromFile(project, envFile)) },
  ],
})

const nextAdapter = (project: Project, web: WebConfig): WebAdapter => ({
  outputDir: web.outputDir ?? 'out',
  cleanDirs: web.cleanDirs ?? ['.next', 'out'],
  dev: ({ envFile, port, devHost }) => withExec(project, 'next', ['dev', '-p', String(port), '-H', '0.0.0.0'], {
    ...envFromFile(project, envFile),
    ...(devHost ? { DEV_HOST: devHost } : {}),
    DEV_PORT: String(port),
  }),
  // 需在 next.config 設 `output: 'export'`，build 才會產出 out/
  generate: ({ envFile }) => [
    { label: 'next build', ...withExec(project, 'next', ['build'], envFromFile(project, envFile)) },
  ],
})

/**
 * 以設定檔寫的指令跑開發伺服器：交給 shell 執行（所以可以寫 `pnpm dev --port {port}` 這類整串指令）。
 * env 檔的每個鍵一律注入子行程環境（不論框架）；需要「檔案路徑」的工具（例如 Nuxt 的 `--dotenv`）
 * 在指令裡用 `{envFile}`。`DEV_PORT` / `DEV_HOST` 照舊以環境變數交棒。
 */
const commandDev = (project: Project, command: string): WebAdapter['dev'] => ({ envFile, port, devHost }) => ({
  ...shellInvocation(fill(command, { envFile, port: String(port), host: devHost ?? '' })),
  env: {
    ...envFromFile(project, envFile),
    ...(devHost ? { DEV_HOST: devHost } : {}),
    DEV_PORT: String(port),
  },
})

/** 以設定檔寫的指令產生靜態網頁：`prepareCommand`（選填）→ `buildCommand`，同樣把 env 檔注入環境。 */
const commandGenerate = (project: Project, prepare: string | undefined, build: string): WebAdapter['generate'] => ({ envFile }) => {
  const env = envFromFile(project, envFile)
  const values = { envFile, port: '', host: '' }
  const steps: WebStep[] = []
  if (prepare) {
    steps.push({ label: 'prepare', ...shellInvocation(fill(prepare, values)), env })
  }
  steps.push({ label: 'build', ...shellInvocation(fill(build, values)), env })
  return steps
}

/**
 * 建立網頁轉接器。`web` 是這次生效的網頁設定（預設最上層 `web`；有環境時傳 `resolveEnvironment` 解出的 `web`）。
 *
 * 先取框架預設（nuxt / vite / next；`custom` 沒有預設），再用設定檔的指令覆寫：
 * 寫了 `devCommand` 就取代開發指令、寫了 `buildCommand`（與選填的 `prepareCommand`）就取代打包步驟，其餘仍用框架預設。
 * 舊寫法 `custom.dev` / `custom.generate` / `custom.prepare` 等同這三個欄位。
 */
export const createWebAdapter = (project: Project, web: WebConfig = project.config.web): WebAdapter => {
  validateWebFramework(web, 'web')
  const devCommand = web.devCommand ?? web.custom?.dev
  const buildCommand = web.buildCommand ?? web.custom?.generate
  const prepareCommand = web.prepareCommand ?? web.custom?.prepare

  const base: WebAdapter = (() => {
    switch (web.framework) {
      case 'nuxt': return nuxtAdapter(project, web)
      case 'vite': return viteAdapter(project, web)
      case 'next': return nextAdapter(project, web)
      case 'custom': return { outputDir: web.outputDir as string, cleanDirs: web.cleanDirs ?? [], dev: commandDev(project, devCommand as string), generate: commandGenerate(project, prepareCommand, buildCommand as string) }
    }
  })()

  return {
    // 沒有框架預設可用時（custom，或明寫指令卻沒寫 framework），產物目錄已由 validateWebFramework 要求必填
    outputDir: web.outputDir ?? base.outputDir,
    cleanDirs: web.cleanDirs ?? base.cleanDirs,
    dev: devCommand ? commandDev(project, devCommand) : base.dev,
    generate: buildCommand ? commandGenerate(project, prepareCommand, buildCommand) : base.generate,
  }
}
