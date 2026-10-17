// 環境解析：把 `--env` / `-e` 的值（環境名或 env 檔路徑）解成「env 檔 + flavor + 簽章 + 生效的網頁設定」。
//
// 規則（刻意不做靜默退回，理由見 shared.resolveEnvFile）：
//   1. 值是設定檔 `environments` 裡的名稱 → 用該環境的 envFile（省略為 `<envDir>/.env.<名稱>`）、flavor、signing、web。
//   2. 否則當成相對專案根的 env 檔路徑；檔案存在才算數。若該路徑恰好是某個已設定環境的 envFile，
//      就視為那個環境（所以選單選到檔案也能套用該環境的設定）。
//   3. 兩者都不是 → 失敗，訊息列出已設定的環境，不猜、不退回預設。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EnvironmentConfig, Project, WebConfig } from './config.ts'
import { ENVIRONMENT_NAME, effectiveWeb } from './config.ts'
import { envNameOf, resolveEnvFile } from './shared.ts'

export interface ResolvedEnvironment {
  /** 環境名：設定檔的名稱；以路徑指定且不在設定檔時由檔名推導（`.env.uat` → `uat`），推導不出來為 null。 */
  name: string | null
  /** env 檔路徑（相對專案根），已確認存在。 */
  envFile: string
  /** 該環境設定的 flavor（旗標 `--flavor` 優先）；沒設定為 null。 */
  flavor: string | null
  /** 該環境設定的簽章檔（相對 App 目錄；旗標 `--signing` 優先）；沒設定為 null。 */
  signing: string | null
  /** 這個環境生效的網頁設定（最上層 `web` 疊上環境的 `web`）。 */
  web: WebConfig
  /** 來自設定檔環境（`config`），或單純的 env 檔路徑（`path`）。 */
  source: 'config' | 'path'
}

export type EnvironmentResult = { ok: true, value: ResolvedEnvironment } | { ok: false, error: string }

const normalize = (path: string): string => path.replace(/^\.\//, '').replace(/\\/g, '/')

/** 環境預設的 env 檔路徑：`<envDir>/.env.<名稱>`。 */
export const defaultEnvFileOf = (project: Project, name: string): string => `${project.config.envDir}/.env.${name}`

const envFileOf = (project: Project, name: string, environment: EnvironmentConfig): string => environment.envFile ?? defaultEnvFileOf(project, name)

const fromConfig = (project: Project, name: string, environment: EnvironmentConfig, envFile: string): ResolvedEnvironment => ({
  name,
  envFile,
  flavor: environment.flavor ?? null,
  signing: environment.signing ?? null,
  web: effectiveWeb(project.config, name),
  source: 'config',
})

const listConfigured = (project: Project): string => {
  const names = Object.keys(project.config.environments)
  return names.length > 0 ? `已設定的環境：${names.join('、')}。` : '設定檔還沒有 environments；可用 `aqutter env add <名稱>` 新增。'
}

/** 解析 `--env` / `-e` 的值。 */
export const resolveEnvironment = (project: Project, value: string): EnvironmentResult => {
  if (value === '') {
    return { ok: false, error: '`--env` / `-e` 需要值（環境名，或相對專案根的 env 檔路徑）。' }
  }
  const environments = project.config.environments

  const configured = Object.hasOwn(environments, value) ? environments[value] : undefined
  if (configured) {
    const envFile = envFileOf(project, value, configured)
    if (!existsSync(join(project.root, envFile))) {
      return {
        ok: false,
        error: `環境「${value}」的 env 檔 \`${envFile}\` 不存在。請由 ${project.config.envDir}/.env.example 複製一份，或修正 aqutter.config.json 的 environments.${value}.envFile。`,
      }
    }
    return { ok: true, value: fromConfig(project, value, configured, envFile) }
  }

  const envFile = resolveEnvFile(project, value)
  if (envFile) {
    const match = Object.entries(environments).find(([name, environment]) => normalize(envFileOf(project, name, environment)) === normalize(envFile))
    if (match) {
      return { ok: true, value: fromConfig(project, match[0], match[1], envFile) }
    }
    return {
      ok: true,
      value: { name: envNameOf(envFile), envFile, flavor: null, signing: null, web: project.config.web, source: 'path' },
    }
  }

  // 只提示、不自動改用：`.env/.env.<值>` 存在，但它不在設定檔裡，也不是使用者給的路徑
  const dir = project.config.envDir
  const conventional = ENVIRONMENT_NAME.test(value) && existsSync(join(project.root, `${dir}/.env.${value}`)) ? `${dir}/.env.${value}` : null
  const hint = conventional
    ? `偵測到 \`${conventional}\` 存在，但「${value}」不在設定檔裡：用 \`aqutter env add ${value}\` 登記它，或改用 -e ${conventional}。`
    : `也可以給相對專案根的 env 檔路徑（例如 ${dir}/.env.uat）。`
  return { ok: false, error: `找不到環境或 env 檔「${value}」。${listConfigured(project)}${hint}` }
}
