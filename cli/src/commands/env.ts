// aqutter env：管理 aqutter.config.json 裡的命名環境。
//
//   aqutter env add <名稱> [--flavor=<名>] [--signing=<路徑>] [--env-file=<路徑>] [--from=<環境名或 env 檔>]
//                          [--dev-command=<指令>] [--build-command=<指令>] [--prepare-command=<指令>] [--output-dir=<目錄>]
//       新增一個環境：寫進設定檔，並建立它的 env 檔（複製 --from，預設 <envDir>/.env.example）。
//       同名環境已存在即中止，不覆寫；env 檔已存在則沿用，不覆寫。
//   aqutter env list
//   aqutter env remove <名稱>    只移除設定檔裡的環境；env 檔、flavor、簽章檔都保留。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { CONFIG_FILE, ConfigError, ENVIRONMENT_NAME } from '../config.ts'
import type { EnvironmentConfig, Project, WebOverrides } from '../config.ts'
import { defaultEnvFileOf, resolveEnvironment } from '../environments.ts'
import { listFlavors } from '../menu.ts'
import { parseArgs } from '../shared.ts'

const TAG = 'env'

export interface AddEnvironmentOptions {
  name: string
  flavor?: string
  signing?: string
  /** 自訂 env 檔路徑（相對專案根）；省略為 `<envDir>/.env.<名稱>`。 */
  envFile?: string
  /** 複製來源：已設定的環境名，或 env 檔路徑；省略為 `<envDir>/.env.example`。 */
  from?: string
  web?: WebOverrides
}

export interface AddEnvironmentResult {
  envFile: string
  /** 這次是否新建了 env 檔（false 代表沿用已存在的檔案）。 */
  createdEnvFile: boolean
  /** 設定了 flavor 但專案裡還沒建這個 flavor。 */
  missingFlavor: boolean
}

const readRawConfig = (project: Project): Record<string, unknown> => {
  return JSON.parse(readFileSync(join(project.root, CONFIG_FILE), 'utf8')) as Record<string, unknown>
}

const writeRawConfig = (project: Project, raw: Record<string, unknown>): void => {
  writeFileSync(join(project.root, CONFIG_FILE), `${JSON.stringify(raw, null, 2)}\n`)
}

const isEmptyObject = (value: object): boolean => Object.keys(value).length === 0

/**
 * 新增環境。先驗證、再建檔、最後才寫設定檔——任何一步失敗都不留下「設定檔有、env 檔沒有」的半套狀態。
 */
export const addEnvironment = (project: Project, options: AddEnvironmentOptions): AddEnvironmentResult => {
  const { name } = options
  if (!ENVIRONMENT_NAME.test(name)) {
    throw new ConfigError(`環境名「${name}」不合法：須為小寫字母開頭，其後為小寫字母、數字或連字號（例如 uat、staging-2）。`)
  }
  if (Object.hasOwn(project.config.environments, name)) {
    throw new ConfigError(`環境「${name}」已存在於 ${CONFIG_FILE}。要修改請直接編輯設定檔；不會覆寫。`)
  }

  const envFile = options.envFile ?? defaultEnvFileOf(project, name)
  const target = join(project.root, envFile)
  const createdEnvFile = !existsSync(target)
  if (createdEnvFile) {
    let source: string
    if (options.from !== undefined) {
      const resolved = resolveEnvironment(project, options.from)
      if (!resolved.ok) {
        throw new ConfigError(`--from 解析失敗：${resolved.error}`)
      }
      source = join(project.root, resolved.value.envFile)
    }
    else {
      source = join(project.root, project.config.envDir, '.env.example')
    }
    mkdirSync(dirname(target), { recursive: true })
    if (existsSync(source)) {
      copyFileSync(source, target)
    }
    else if (options.from !== undefined) {
      throw new ConfigError(`--from 的來源 \`${source}\` 不存在。`)
    }
    else {
      writeFileSync(target, `# ${name} 環境的設定。由 aqutter env add 建立；鍵的說明見 docs/environment.md。\n`)
    }
  }

  const raw = readRawConfig(project)
  const environments = (typeof raw.environments === 'object' && raw.environments !== null ? raw.environments : {}) as Record<string, EnvironmentConfig>
  const entry: EnvironmentConfig = {}
  // 預設路徑可以省略不寫：設定檔只留與慣例不同的部分
  if (envFile !== defaultEnvFileOf(project, name)) {
    entry.envFile = envFile
  }
  if (options.flavor) {
    entry.flavor = options.flavor
  }
  if (options.signing) {
    entry.signing = options.signing
  }
  if (options.web && !isEmptyObject(options.web)) {
    entry.web = options.web
  }
  environments[name] = entry
  raw.environments = environments
  writeRawConfig(project, raw)
  project.config.environments[name] = entry

  return {
    envFile,
    createdEnvFile,
    missingFlavor: Boolean(options.flavor) && !listFlavors(project).some(flavor => flavor.name === options.flavor),
  }
}

/** 從設定檔移除環境（不動 env 檔、flavor、簽章檔）。回傳被移除的 env 檔路徑。 */
export const removeEnvironment = (project: Project, name: string): string => {
  if (!Object.hasOwn(project.config.environments, name)) {
    throw new ConfigError(`設定檔沒有環境「${name}」。已設定的環境：${Object.keys(project.config.environments).join('、') || '（無）'}。`)
  }
  const envFile = project.config.environments[name].envFile ?? defaultEnvFileOf(project, name)
  const raw = readRawConfig(project)
  const environments = (raw.environments ?? {}) as Record<string, EnvironmentConfig>
  delete environments[name]
  if (isEmptyObject(environments)) {
    delete raw.environments
  }
  else {
    raw.environments = environments
  }
  writeRawConfig(project, raw)
  delete project.config.environments[name]
  return envFile
}

const describeWeb = (web: WebOverrides | undefined): string => {
  if (!web) {
    return '-'
  }
  const keys = Object.keys(web)
  return keys.length > 0 ? keys.join(',') : '-'
}

export const listEnvironments = (project: Project): string[] => {
  const lines: string[] = []
  for (const [name, environment] of Object.entries(project.config.environments)) {
    const envFile = environment.envFile ?? defaultEnvFileOf(project, name)
    lines.push(
      `${name}  env=${envFile}${existsSync(join(project.root, envFile)) ? '' : '（檔案不存在）'}`
      + `  flavor=${environment.flavor ?? '-'}  signing=${environment.signing ?? '-'}  web覆蓋=${describeWeb(environment.web)}`,
    )
  }
  return lines
}

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

const USAGE = '用法：aqutter env add <名稱> [--flavor=<名>] [--signing=<路徑>] [--from=<環境名或 env 檔>] [--dev-command=<指令>] [--build-command=<指令>] | aqutter env list | aqutter env remove <名稱>'

export const runEnv = async (project: Project, argv: string[]): Promise<void> => {
  const { positional, flags } = parseArgs(argv)
  const [subcommand, name] = positional
  try {
    switch (subcommand) {
      case 'add': {
        if (!name) {
          return fail(USAGE)
        }
        const web: WebOverrides = {}
        if (flags['dev-command'] !== undefined) {
          web.devCommand = flags['dev-command']
        }
        if (flags['build-command'] !== undefined) {
          web.buildCommand = flags['build-command']
        }
        if (flags['prepare-command'] !== undefined) {
          web.prepareCommand = flags['prepare-command']
        }
        if (flags['output-dir'] !== undefined) {
          web.outputDir = flags['output-dir']
        }
        const result = addEnvironment(project, {
          name,
          flavor: flags.flavor,
          signing: flags.signing,
          envFile: flags['env-file'],
          from: flags.from,
          web,
        })
        console.log(`[${TAG}] 已新增環境「${name}」（${CONFIG_FILE}）。`)
        console.log(`[${TAG}] env 檔：${result.envFile}${result.createdEnvFile ? '（已建立，請填入這個環境的值）' : '（已存在，沿用）'}`)
        if (result.missingFlavor) {
          console.log(`[${TAG}] flavor「${flags.flavor}」還沒建立：執行 \`aqutter flavor add ${flags.flavor}\`。`)
        }
        console.log(`[${TAG}] 使用：aqutter dev -e ${name} <target> ／ aqutter build -e ${name} <platform>`)
        return
      }
      case 'list': {
        const lines = listEnvironments(project)
        console.log(lines.length > 0 ? lines.join('\n') : `[${TAG}] 設定檔還沒有 environments。用 \`aqutter env add <名稱>\` 新增。`)
        return
      }
      case 'remove': {
        if (!name) {
          return fail(USAGE)
        }
        const envFile = removeEnvironment(project, name)
        console.log(`[${TAG}] 已從 ${CONFIG_FILE} 移除環境「${name}」；env 檔 ${envFile}、flavor 與簽章檔都保留。`)
        return
      }
      default:
        return fail(USAGE)
    }
  }
  catch (error) {
    if (error instanceof ConfigError) {
      return fail(error.message)
    }
    throw error
  }
}
