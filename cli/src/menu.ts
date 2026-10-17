// dev / build 無參數時的互動選單：選項全部由掃描偵測，不維護任何硬編清單。
//   env 檔   : <envDir>/.env.*（排除檔名含 .example 者）
//   flavor   : Android build.gradle.kts 的 create("<name>") ∪ iOS / macOS pbxproj 的 Release-<name>
//   簽章設定 : <appDir>/signing/signing.<name>.json（排除檔名含 .example 者），以頂層鍵標示涵蓋平台
// 選單建在 shared.createPrompter 之上：同一個 readline、排隊 line 事件，管線餵答案可測。
// 另提供 resolveXEnv：`--x-env=<name>` 一個旗標展開為 env / flavor / signing 三項，偵測來源與選單相同。

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Project } from './config.ts'
import type { Flags, Prompter } from './shared.ts'

const ENV_PREFIX = '.env.'
// 簽章設定檔命名規範：signing.<name>.json；<name> 與 env 檔的 <name> 對應，供 --x-env 直接推導
const SIGNING_FILE = /^signing\.(.+)\.json$/
// 範本檔（.env.example、signing.example.json）不是可選項
const EXAMPLE_MARK = '.example'
const isExample = (name: string): boolean => name.includes(EXAMPLE_MARK)

export type SigningPlatform = 'ios' | 'macos' | 'windows'
const SIGNING_PLATFORMS: string[] = ['ios', 'macos', 'windows']

export interface EnvFileEntry {
  path: string
  name: string
}

export interface FlavorEntry {
  name: string
  platforms: string[]
}

export interface SigningEntry {
  path: string
  name: string
  platforms: string[]
}

/** `--x-env=<name>` 對應的 env 檔路徑（相對專案根）。 */
export const envPathOf = (project: Project, name: string): string => `${project.config.envDir}/${ENV_PREFIX}${name}`
/** `--x-env=<name>` 對應的簽章設定檔路徑（相對 App 目錄）。 */
export const signingPathOf = (name: string): string => `signing/signing.${name}.json`

/** 目錄不存在時回空陣列，讓呼叫端統一走「沒有選項」的路徑。 */
const listDir = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir) : [])

/** env 目錄下的 env 檔：`{ path: '.env/.env.dev', name: 'dev' }`，依名稱排序。 */
export const listEnvFiles = (project: Project): EnvFileEntry[] => {
  return listDir(join(project.root, project.config.envDir))
    .filter(name => name.startsWith(ENV_PREFIX) && !isExample(name))
    .sort()
    .map(name => ({
      path: `${project.config.envDir}/${name}`,
      name: name.slice(ENV_PREFIX.length),
    }))
}

const readIfExists = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '')

/**
 * 已建立的 flavor：`{ name, platforms: ['android', 'ios', 'macos'] }`。
 * 來源與 flavor add 寫入處對稱——Gradle 的 create("<name>")、pbxproj 的 name = "Release-<name>"。
 */
export const listFlavors = (project: Project): FlavorEntry[] => {
  const found = new Map<string, Set<string>>()
  const add = (name: string, platform: string): void => {
    const platforms = found.get(name) ?? new Set<string>()
    platforms.add(platform)
    found.set(name, platforms)
  }
  const gradle = readIfExists(join(project.appDir, 'android', 'app', 'build.gradle.kts'))
  for (const match of gradle.matchAll(/create\("([a-z][a-z0-9]*)"\)/g)) {
    add(match[1], 'android')
  }
  for (const platform of ['ios', 'macos']) {
    const pbxproj = readIfExists(join(project.appDir, platform, 'Runner.xcodeproj', 'project.pbxproj'))
    for (const match of pbxproj.matchAll(/name = "Release-([a-z][a-z0-9]*)";/g)) {
      add(match[1], platform)
    }
  }
  return [...found.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, platforms]) => ({
      name,
      platforms: [...platforms],
    }))
}

/** 簽章設定檔：`{ path: 'signing/signing.uat.json', name: 'uat', platforms: ['ios', 'macos'] }`（platforms 取 JSON 頂層鍵）。 */
export const listSigningConfigs = (project: Project): SigningEntry[] => {
  const dir = join(project.appDir, 'signing')
  return listDir(dir)
    .filter(name => SIGNING_FILE.test(name) && !isExample(name))
    .sort()
    .map((name) => {
      let platforms: string[] = []
      try {
        platforms = Object.keys(JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>)
          .filter(key => SIGNING_PLATFORMS.includes(key))
      }
      catch {
        // 壞掉的 JSON 仍列出，讓使用者選到時由 readSigningConfig 給出明確錯誤
      }
      return {
        path: `signing/${name}`,
        name: (SIGNING_FILE.exec(name) as RegExpExecArray)[1],
        platforms,
      }
    })
}

export interface XEnvResult {
  envPath: string | null
  flavor: string | null
  signingPath: string | null
}

/**
 * `--x-env=<name>` 展開：env 一律推導（存在性由呼叫端的 resolveEnvFile 判定，缺即中止）；
 * flavor 與簽章設定檔**可缺**——沒建 / 沒檔就略過並印一行，不視為錯誤。
 * 明給的 --env / --flavor / --signing 優先於展開值（x-env 是預設組，單項可覆寫）。
 * 回傳 { envPath, flavor, signingPath }，未指定 x-env 且未明給者為 null，交由呼叫端沿用各自預設。
 */
export const resolveXEnv = (project: Project, flags: Flags, {
  tag, withSigning,
}: { tag: string, withSigning: boolean }): XEnvResult => {
  const xEnv = flags['x-env'] ?? null
  // 名稱在設定檔的 environments 裡：以設定檔為準（env 檔、flavor、簽章都由 resolveEnvironment 帶入），不再走檔名慣例
  const configured = xEnv !== null && Object.hasOwn(project.config.environments, xEnv)
  const envPath = flags.env ?? (xEnv ? (configured ? xEnv : envPathOf(project, xEnv)) : null)

  let flavor = flags.flavor ?? null
  if (configured) {
    return { envPath, flavor, signingPath: flags.signing ?? null }
  }
  if (flavor === null && xEnv) {
    if (listFlavors(project).some(entry => entry.name === xEnv)) {
      flavor = xEnv
    }
    else {
      console.log(`[${tag}] --x-env=${xEnv}：未建 flavor「${xEnv}」，不帶 --flavor。`)
    }
  }

  let signingPath = flags.signing ?? null
  if (withSigning && signingPath === null && xEnv) {
    const candidate = signingPathOf(xEnv)
    if (existsSync(join(project.appDir, candidate))) {
      signingPath = candidate
    }
    else {
      console.log(`[${tag}] --x-env=${xEnv}：找不到 ${candidate}，不帶 --signing。`)
    }
  }

  return {
    envPath,
    flavor,
    signingPath,
  }
}

export interface MenuOption {
  label: string
}

const printOptions = (title: string, options: MenuOption[]): void => {
  console.log(`\n${title}`)
  options.forEach((option, index) => console.log(`  ${index + 1}) ${option.label}`))
}

/**
 * 單選：印編號清單、讀一行；空白採 `defaultIndex`（有給的話），無效輸入重問。
 * 回傳被選的 option 物件。
 */
export const chooseOne = async <T extends MenuOption>(prompter: Prompter, title: string, options: T[], defaultIndex: number | null = null): Promise<T> => {
  printOptions(title, options)
  const hint = defaultIndex === null ? '' : ` [${defaultIndex + 1}]`
  for (;;) {
    const answer = await prompter.ask(`輸入編號${hint}：`)
    if (answer === '' && defaultIndex !== null) {
      return options[defaultIndex]
    }
    const index = Number.parseInt(answer, 10) - 1
    if (Number.isInteger(index) && index >= 0 && index < options.length) {
      return options[index]
    }
    console.log('  無效的選擇，請重新輸入。')
  }
}

/**
 * 多選：接受 `1,3` / `1 3` / `all`，至少選一個；重複編號去重、保持清單順序。
 * 回傳被選的 option 陣列。
 */
export const chooseMany = async <T extends MenuOption>(prompter: Prompter, title: string, options: T[]): Promise<T[]> => {
  printOptions(title, options)
  for (;;) {
    const answer = (await prompter.ask('輸入編號（可多選，逗號或空白分隔；all＝全部）：')).toLowerCase()
    if (answer === 'all') {
      return [...options]
    }
    const tokens = answer.split(/[\s,]+/).filter(Boolean)
    const indexes = tokens.map(token => Number.parseInt(token, 10) - 1)
    const valid = tokens.length > 0
      && indexes.every(index => Number.isInteger(index) && index >= 0 && index < options.length)
    if (valid) {
      const picked = new Set(indexes)
      return options.filter((_, index) => picked.has(index))
    }
    console.log('  無效的選擇，請重新輸入。')
  }
}
