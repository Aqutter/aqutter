// 網頁框架轉接器：把「怎麼起 dev server、怎麼產生靜態網頁」收攏成一處，
// 其餘指令（dev / seed / build）只認這個介面，不認任何特定框架。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Project } from './config.ts'
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

const nuxtAdapter = (project: Project): WebAdapter => ({
  outputDir: project.config.web.outputDir ?? '.output/public',
  cleanDirs: project.config.web.cleanDirs ?? ['.nuxt', '.output'],
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

const viteAdapter = (project: Project): WebAdapter => ({
  outputDir: project.config.web.outputDir ?? 'dist',
  cleanDirs: project.config.web.cleanDirs ?? ['dist'],
  dev: ({ envFile, port, devHost }) => withExec(project, 'vite', ['--port', String(port), '--strictPort', '--host'], {
    ...envFromFile(project, envFile),
    ...(devHost ? { DEV_HOST: devHost } : {}),
    DEV_PORT: String(port),
  }),
  generate: ({ envFile }) => [
    { label: 'vite build', ...withExec(project, 'vite', ['build'], envFromFile(project, envFile)) },
  ],
})

const nextAdapter = (project: Project): WebAdapter => ({
  outputDir: project.config.web.outputDir ?? 'out',
  cleanDirs: project.config.web.cleanDirs ?? ['.next', 'out'],
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

const customAdapter = (project: Project): WebAdapter => {
  const custom = project.config.web.custom
  if (!custom) {
    throw new Error('web.framework 為 custom 時必須設定 web.custom。')
  }
  const outputDir = project.config.web.outputDir
  if (!outputDir) {
    throw new Error('web.framework 為 custom 時必須設定 web.outputDir。')
  }
  return {
    outputDir,
    cleanDirs: project.config.web.cleanDirs ?? [],
    dev: ({ envFile, port, devHost }) => ({
      ...shellInvocation(fill(custom.dev, { envFile, port: String(port), host: devHost ?? '' })),
      env: {
        ...envFromFile(project, envFile),
        ...(devHost ? { DEV_HOST: devHost } : {}),
        DEV_PORT: String(port),
      },
    }),
    generate: ({ envFile }) => {
      const env = envFromFile(project, envFile)
      const values = { envFile, port: '', host: '' }
      const steps: WebStep[] = []
      if (custom.prepare) {
        steps.push({ label: 'prepare', ...shellInvocation(fill(custom.prepare, values)), env })
      }
      steps.push({ label: 'generate', ...shellInvocation(fill(custom.generate, values)), env })
      return steps
    },
  }
}

export const createWebAdapter = (project: Project): WebAdapter => {
  switch (project.config.web.framework) {
    case 'nuxt': return nuxtAdapter(project)
    case 'vite': return viteAdapter(project)
    case 'next': return nextAdapter(project)
    case 'custom': return customAdapter(project)
  }
}
