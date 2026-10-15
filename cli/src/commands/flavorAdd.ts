// Flutter flavor 建立器：以問答方式蒐集 flavor 名 / 顯示名 / 識別字後，一次寫進 Android、iOS、macOS
// 三個原生專案，讓 `--flavor=<name>` 在 apk / aab / ipa / ios / macos 都能跑。
// Windows / Linux 自 Flutter 3.47 起內建 flavor（產物隔離到 <arch>/<flavor>/），不需任何設定。
//
// 用法：aqutter flavor add [<name>]
//
// 各平台實際動的檔案：
//   Android : android/app/build.gradle.kts（flavorDimensions + productFlavors.create）
//             android/app/src/main/AndroidManifest.xml（一次性：android:label → @string/app_name，
//             預設值以 defaultConfig.resValue 提供，flavor 的 resValue 才覆蓋得了它）
//   iOS/macOS: <platform>/Runner.xcodeproj/project.pbxproj（純文字：複製 Debug/Release/Profile 三個
//             XCBuildConfiguration 為 <Mode>-<name>、追加到每個 XCConfigurationList；Runner target
//             的副本覆寫 PRODUCT_BUNDLE_IDENTIFIER 與 APP_DISPLAY_NAME）
//             <platform>/Runner.xcodeproj/xcshareddata/xcschemes/<name>.xcscheme（以 Runner.xcscheme 為模板）
//             <platform>/Runner/Info.plist（一次性：CFBundleDisplayName → $(APP_DISPLAY_NAME)）
//
// 不寫任何簽章欄位：iOS / macOS 的 manual 簽章由 `aqutter build … --signing=` 在 archive / export
// 階段以 build settings 帶入，flavor 只負責身分。
// 已存在同名 flavor（Gradle 的 create("<name>")、pbxproj 的 Release-<name>、同名 scheme）一律中止，
// 不覆寫、不半套；其他一次性接線則冪等（已接過就跳過）。
//
// pbxproj 純文字操作的依據：它是 Xcode 以固定縮排寫出的 ASCII plist，每個物件以
// `\t\t<ID> /* name */ = {` 起、同縮排 `\t\t};` 結，巢狀的 `};` 縮排一定更深；複製區塊不動其他任何
// 位元，git diff 與在 Xcode 內 Duplicate configuration 的結果同形，也不需新增 npm 依賴。
//
// 本檔分兩層：文字轉換函式是純函式（字串進、字串出，失敗丟 FlavorAddError），可單獨測試；
// runFlavorAdd 負責問答與檔案讀寫，並把 FlavorAddError 轉成與原本 `fail` 相同的「印訊息 + exit 1」。

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Project } from '../config.ts'
import { createPrompter, parseArgs } from '../shared.ts'

const TAG = 'flavor add'

/** 轉換失敗（找不到插入點、已有同名 flavor…）；由 runFlavorAdd 統一轉成訊息 + exit 1。 */
export class FlavorAddError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FlavorAddError'
  }
}

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

// flavor 名同時是 Gradle productFlavor 名、Xcode scheme 名與 `<Mode>-<name>` configuration 後綴；
// 限小寫字母開頭的英數字，避免 Gradle 任務名（`assembleUatRelease`）與 xcodebuild 參數逃逸問題。
export const FLAVOR_NAME_PATTERN = /^[a-z][a-z0-9]*$/

// Xcode 的三種 build mode；Flutter 依 `<Mode>-<flavor>` 命名慣例找 configuration。
const XCODE_MODES = ['Debug', 'Release', 'Profile']

// Gradle flavor 維度名；本專案只用一個維度（環境 / 身分）。
const GRADLE_DIMENSION = 'env'

const ANDROID_LABEL_RESOURCE = '@string/app_name'

// pbxproj 物件 ID：24 位大寫 hex。
const PBX_ID_BYTES = 12
const PBX_INDENT = '\t\t'
const BUILD_SETTING_INDENT = '\t\t\t\t'

// Info.plist 的縮排（Xcode 範本用單一 tab）
const PLIST_INDENT = '\t'

const GRADLE_FILE_LABEL = 'android/app/build.gradle.kts'

export interface GradleFlavor {
  name: string
  applicationId: string
  displayName: string
}

export interface XcodeFlavor {
  name: string
  bundleId: string
  displayName: string
}

export interface WiredAndroid {
  gradle: string
  manifest: string
  changed: boolean
}

export interface WiredDisplayName {
  pbxproj: string
  plist: string
  changed: boolean
}

export interface BuildConfiguration {
  id: string
  name: string
  text: string
}

export interface XcodeIdentity {
  bundleId: string | null
  displayName: string | null
}

/** 放進 Kotlin 字串常值：跳脫 \ 與 "。 */
const kotlinEscape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/** 放進 pbxproj 的雙引號字串：跳脫 \ 與 "。 */
const pbxEscape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

// ---------------------------------------------------------------------------
// Android
// ---------------------------------------------------------------------------

/** 從 gradle 讀 defaultConfig 的 applicationId（作為預設值的基底）。 */
export const readAndroidApplicationId = (gradle: string): string | null => {
  const match = /^\s*applicationId\s*=\s*"([^"]+)"/m.exec(gradle)
  return match ? match[1] : null
}

/** 從 manifest 讀 <application android:label="…">；已接到 @string/ 時回 null（顯示名改由 gradle 提供）。 */
export const readAndroidLabel = (manifest: string): string | null => {
  const match = /<application[^>]*\sandroid:label="([^"]*)"/s.exec(manifest)
  if (!match || match[1].startsWith('@')) {
    return null
  }
  return match[1]
}

/**
 * 一次性接線：manifest 的 android:label 改指向 @string/app_name，原字串移到 defaultConfig 的
 * resValue 當預設——flavor 的 resValue 覆蓋 defaultConfig 的是 AGP 明定的優先序；若改放在
 * res/values/strings.xml，與 flavor 的 resValue 會在合併階段撞成 Duplicate resources。
 * 已接過（label 已是 @string/、defaultConfig 已有 app_name）就原樣回傳。
 */
export const wireAndroidLabel = (gradle: string, manifest: string, gradleFile = GRADLE_FILE_LABEL): WiredAndroid => {
  const label = readAndroidLabel(manifest)
  if (label === null) {
    return {
      gradle,
      manifest,
      changed: false,
    }
  }
  const wiredManifest = manifest.replace(
    /(<application[^>]*\sandroid:label=")[^"]*(")/s,
    `$1${ANDROID_LABEL_RESOURCE}$2`,
  )
  let wiredGradle = gradle
  // AGP 9 預設關閉 resValues 功能，defaultConfig / flavor 一用 resValue 就在設定階段報
  // "custom resource values, but the feature is disabled"，故一併打開。
  if (!/resValues\s*=\s*true/.test(wiredGradle)) {
    const before = wiredGradle
    wiredGradle = wiredGradle.replace(
      /\n {4}buildTypes \{/,
      '\n    buildFeatures {\n        resValues = true\n    }\n\n    buildTypes {',
    )
    if (wiredGradle === before) {
      throw new FlavorAddError(`在 ${gradleFile} 找不到 buildTypes { … }，無法插入 buildFeatures。`)
    }
  }
  if (!/resValue\("string",\s*"app_name"/.test(wiredGradle)) {
    // defaultConfig 區塊的結尾：`    }` 於 8 空格縮排的 versionName 之後、第一個 4 空格 `}`
    const before = wiredGradle
    wiredGradle = wiredGradle.replace(
      /(\n {4}defaultConfig \{\n[\s\S]*?)(\n {4}\})/,
      `$1\n        resValue("string", "app_name", "${kotlinEscape(label)}")$2`,
    )
    if (wiredGradle === before) {
      throw new FlavorAddError(`在 ${gradleFile} 找不到 defaultConfig { … } 區塊，無法接線 app_name。`)
    }
  }
  return {
    gradle: wiredGradle,
    manifest: wiredManifest,
    changed: true,
  }
}

/** 產生 productFlavors 內的 create 區塊（8 空格縮排，與 Flutter 範本的 Kotlin DSL 一致）。 */
export const renderGradleFlavor = ({
  name, applicationId, displayName,
}: GradleFlavor): string => `        create("${name}") {
            dimension = "${GRADLE_DIMENSION}"
            applicationId = "${kotlinEscape(applicationId)}"
            resValue("string", "app_name", "${kotlinEscape(displayName)}")
        }
`

/**
 * 在 build.gradle.kts 加入 flavor：已有 productFlavors { } 就追加 create，沒有就連
 * flavorDimensions 一起插在 buildTypes 之前。
 */
export const addGradleFlavor = (gradle: string, flavor: GradleFlavor, gradleFile = GRADLE_FILE_LABEL): string => {
  if (new RegExp(`create\\("${flavor.name}"\\)`).test(gradle)) {
    throw new FlavorAddError(`Android 已有 flavor "${flavor.name}"（${gradleFile}），未變更任何檔案。`)
  }
  const block = renderGradleFlavor(flavor)
  if (/\n {4}productFlavors \{/.test(gradle)) {
    // 追加到 productFlavors 區塊尾端（它的結尾是 4 空格縮排的 `}`）
    const updated = gradle.replace(/(\n {4}productFlavors \{\n[\s\S]*?)(\n {4}\})/, `$1\n${block.trimEnd()}$2`)
    if (updated === gradle) {
      throw new FlavorAddError(`在 ${gradleFile} 找到 productFlavors 但解析不出區塊結尾。`)
    }
    return updated
  }
  const inserted = gradle.replace(
    /\n {4}buildTypes \{/,
    `\n    flavorDimensions += "${GRADLE_DIMENSION}"\n    productFlavors {\n${block}    }\n\n    buildTypes {`,
  )
  if (inserted === gradle) {
    throw new FlavorAddError(`在 ${gradleFile} 找不到 buildTypes { … }，無法決定 productFlavors 的插入點。`)
  }
  return inserted
}

// ---------------------------------------------------------------------------
// iOS / macOS（pbxproj 純文字）
// ---------------------------------------------------------------------------

/** 產生尚未在 pbxproj 出現過的 24 位 hex ID。 */
export const newPbxId = (pbxproj: string): string => {
  for (;;) {
    const id = randomBytes(PBX_ID_BYTES).toString('hex').toUpperCase()
    if (!pbxproj.includes(id)) {
      return id
    }
  }
}

/** pbxproj 的物件名：含 `-` 等非識別字字元時 Xcode 會加引號。 */
const PBX_BARE_NAME = /^[A-Za-z0-9_.]+$/
export const pbxName = (name: string): string => {
  return PBX_BARE_NAME.test(name) ? name : `"${pbxEscape(name)}"`
}

/**
 * 列出 XCBuildConfiguration 區段內的每個物件：{ id, name, text }。
 * 區塊起於 `\t\t<ID> /＊ name ＊/ = {`（全形星號代指 pbxproj 的註解）、止於同縮排的 `\t\t};`；巢狀 `};` 縮排必定更深，故不會誤切。
 */
export const listBuildConfigurations = (pbxproj: string): BuildConfiguration[] => {
  const begin = pbxproj.indexOf('/* Begin XCBuildConfiguration section */')
  const end = pbxproj.indexOf('/* End XCBuildConfiguration section */')
  if (begin < 0 || end < 0) {
    throw new FlavorAddError('pbxproj 缺少 XCBuildConfiguration 區段。')
  }
  const section = pbxproj.slice(begin, end)
  const pattern = /^\t\t([0-9A-F]{24}) \/\* (.+?) \*\/ = \{\n[\s\S]*?\n\t\t\};\n/gm
  const blocks: BuildConfiguration[] = []
  for (const match of section.matchAll(pattern)) {
    blocks.push({
      id: match[1],
      name: match[2],
      text: match[0],
    })
  }
  return blocks
}

/** 讀區塊內某個 build setting 的值（單行者）；沒有回 null。 */
export const readBuildSetting = (blockText: string, key: string): string | null => {
  const match = new RegExp(`^\\t\\t\\t\\t${key} = (.*);$`, 'm').exec(blockText)
  if (!match) {
    return null
  }
  const raw = match[1]
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(.)/g, '$1') : raw
}

/**
 * 設定區塊內的 build setting：已有就改值，沒有就依字母序插入（pbxproj 的 buildSettings 是排序的，
 * 亂序 Xcode 讀得到但下次存檔會整段重排、diff 變髒）。多行值（陣列）的行不以 `KEY = ` 起頭，不參與比較。
 */
export const setBuildSetting = (blockText: string, key: string, value: string): string => {
  const line = `${BUILD_SETTING_INDENT}${key} = ${value};`
  const existing = new RegExp(`^\\t\\t\\t\\t${key} = .*;$`, 'm')
  if (existing.test(blockText)) {
    return blockText.replace(existing, line)
  }
  const lines = blockText.split('\n')
  const start = lines.findIndex(entry => entry === '\t\t\tbuildSettings = {')
  if (start < 0) {
    throw new FlavorAddError('pbxproj 的 XCBuildConfiguration 區塊缺 buildSettings。')
  }
  let insertAt = lines.findIndex((entry, index) => index > start && entry === '\t\t\t};')
  for (let index = start + 1; index < insertAt; index += 1) {
    const match = /^\t\t\t\t([A-Z_][A-Z0-9_]*) = /.exec(lines[index])
    if (match && match[1] > key) {
      insertAt = index
      break
    }
  }
  lines.splice(insertAt, 0, line)
  return lines.join('\n')
}

/**
 * Runner 主 target 的 configuration ID 集合：取自 `Build configuration list for PBXNativeTarget "Runner"`。
 * 不能靠 buildSettings 內容判定——macOS 範本的 Runner target 沒有 PRODUCT_BUNDLE_IDENTIFIER（由
 * AppInfo.xcconfig 提供），iOS 的才有。
 */
export const runnerConfigurationIds = (pbxproj: string): Set<string> => {
  const match = /\/\* Build configuration list for PBXNativeTarget "Runner" \*\/ = \{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = \(\n([\s\S]*?)\t\t\t\);/.exec(pbxproj)
  if (!match) {
    throw new FlavorAddError('pbxproj 找不到 PBXNativeTarget "Runner" 的 configuration list。')
  }
  return new Set([...match[1].matchAll(/^\t\t\t\t([0-9A-F]{24}) /gm)].map(entry => entry[1]))
}

/**
 * 讀 Runner target Release configuration 的 bundle id 與顯示名（作預設值）。
 * bundle id 在 config 層找不到時退而讀 xcconfig 全文（macOS 範本放在 Runner/Configs/AppInfo.xcconfig；
 * 不存在則傳 null）。
 */
export const readXcodeIdentity = (pbxproj: string, appInfoXcconfig: string | null): XcodeIdentity => {
  const runnerIds = runnerConfigurationIds(pbxproj)
  const release = listBuildConfigurations(pbxproj)
    .find(block => block.name === 'Release' && runnerIds.has(block.id))
  if (!release) {
    throw new FlavorAddError('pbxproj 找不到 Runner target 的 Release configuration。')
  }
  let bundleId = readBuildSetting(release.text, 'PRODUCT_BUNDLE_IDENTIFIER')
  if (bundleId === null && appInfoXcconfig !== null) {
    const match = /^PRODUCT_BUNDLE_IDENTIFIER = (.+)$/m.exec(appInfoXcconfig)
    bundleId = match ? match[1].trim() : null
  }
  return {
    bundleId,
    displayName: readBuildSetting(release.text, 'APP_DISPLAY_NAME'),
  }
}

/** Info.plist 的 CFBundleDisplayName 字串；沒有該鍵回 null。 */
export const readPlistDisplayName = (plist: string): string | null => {
  const match = /<key>CFBundleDisplayName<\/key>\n\t<string>([^<]*)<\/string>/.exec(plist)
  return match ? match[1] : null
}

/**
 * 一次性接線：Info.plist 的 CFBundleDisplayName 改為 $(APP_DISPLAY_NAME)，原字串寫進 Runner target
 * 既有的 Debug / Release / Profile 三個 configuration；macOS 範本沒有這個鍵，補在 CFBundleDevelopmentRegion 之後。
 * 已接過（值已是 $(APP_DISPLAY_NAME)）就原樣回傳。
 */
export const wireDisplayName = (pbxproj: string, plist: string, fallbackDisplayName: string): WiredDisplayName => {
  const current = readPlistDisplayName(plist)
  if (current === '$(APP_DISPLAY_NAME)') {
    return {
      pbxproj,
      plist,
      changed: false,
    }
  }
  const original = current ?? fallbackDisplayName
  const entry = `${PLIST_INDENT}<key>CFBundleDisplayName</key>\n${PLIST_INDENT}<string>$(APP_DISPLAY_NAME)</string>`
  // 注意：replace 的替換字串含 `$(`，用函式回傳以免 `$` 被當成替換樣式
  const wiredPlist = current === null
    ? plist.replace(
        /(\t<key>CFBundleDevelopmentRegion<\/key>\n\t<string>[^<]*<\/string>\n)/,
        (_whole, region: string) => `${region}${entry}\n`,
      )
    : plist.replace(
        /\t<key>CFBundleDisplayName<\/key>\n\t<string>[^<]*<\/string>/,
        () => entry,
      )
  if (wiredPlist === plist) {
    throw new FlavorAddError('Info.plist 找不到可接線 CFBundleDisplayName 的位置。')
  }
  let wiredPbxproj = pbxproj
  const runnerIds = runnerConfigurationIds(pbxproj)
  for (const block of listBuildConfigurations(pbxproj)) {
    if (!XCODE_MODES.includes(block.name) || !runnerIds.has(block.id)) {
      continue
    }
    if (readBuildSetting(block.text, 'APP_DISPLAY_NAME') !== null) {
      continue
    }
    const wiredBlock = setBuildSetting(block.text, 'APP_DISPLAY_NAME', `"${pbxEscape(original)}"`)
    wiredPbxproj = wiredPbxproj.replace(block.text, () => wiredBlock)
  }
  return {
    pbxproj: wiredPbxproj,
    plist: wiredPlist,
    changed: true,
  }
}

/**
 * 複製 Debug / Release / Profile 三個 configuration 為 <Mode>-<name>（每個 target 各一組），
 * 並把新 ID 追加到對應的 XCConfigurationList。回傳新的 pbxproj 全文。
 * `generateId` 可注入以便測試取得固定 ID。
 */
export const addXcodeConfigurations = (pbxproj: string, flavor: XcodeFlavor, generateId: (existing: string) => string = newPbxId): string => {
  const blocks = listBuildConfigurations(pbxproj)
  if (blocks.some(block => block.name === `Release-${flavor.name}`)) {
    throw new FlavorAddError(`Xcode 專案已有 configuration "Release-${flavor.name}"，未變更任何檔案。`)
  }
  const sources = blocks.filter(block => XCODE_MODES.includes(block.name))
  if (sources.length === 0) {
    throw new FlavorAddError('pbxproj 找不到 Debug / Release / Profile configuration。')
  }

  let updated = pbxproj
  const runnerIds = runnerConfigurationIds(pbxproj)
  const clones = new Map<string, { id: string, name: string }>() // 原 ID → { id, name }
  let appended = ''
  for (const source of sources) {
    const name = `${source.name}-${flavor.name}`
    const id = generateId(updated + appended)
    let text = source.text
      .replace(`${PBX_INDENT}${source.id} /* ${source.name} */ = {`, `${PBX_INDENT}${id} /* ${name} */ = {`)
      .replace(/^\t\t\tname = .*;$/m, `\t\t\tname = ${pbxName(name)};`)
    if (runnerIds.has(source.id)) {
      text = setBuildSetting(text, 'PRODUCT_BUNDLE_IDENTIFIER', flavor.bundleId)
      text = setBuildSetting(text, 'APP_DISPLAY_NAME', `"${pbxEscape(flavor.displayName)}"`)
    }
    appended += text
    clones.set(source.id, {
      id,
      name,
    })
  }
  updated = updated.replace('/* End XCBuildConfiguration section */', () => `${appended}/* End XCBuildConfiguration section */`)

  // 每個 XCConfigurationList 的 buildConfigurations = ( … ) 追加對應副本
  updated = updated.replace(
    /(\t\t\tbuildConfigurations = \(\n)([\s\S]*?)(\t\t\t\);)/g,
    (_whole, open: string, body: string, close: string) => {
      const additions = [...body.matchAll(/^\t\t\t\t([0-9A-F]{24}) \/\* .+? \*\/,$/gm)]
        .map(match => clones.get(match[1]))
        .filter((clone): clone is { id: string, name: string } => clone !== undefined)
        .map(clone => `\t\t\t\t${clone.id} /* ${clone.name} */,\n`)
        .join('')
      return `${open}${body}${additions}${close}`
    },
  )
  return updated
}

/** 以 Runner.xcscheme 全文為模板產生 <name>.xcscheme：所有 buildConfiguration 改指向 <Mode>-<name>。 */
export const renderXcodeScheme = (template: string, name: string): string => {
  return template.replace(
    /buildConfiguration = "(Debug|Release|Profile)"/g,
    `buildConfiguration = "$1-${name}"`,
  )
}

// ---------------------------------------------------------------------------
// 檔案層（讀寫磁碟）
// ---------------------------------------------------------------------------

interface Paths {
  androidGradle: string
  androidManifest: string
  xcodeProject: (platform: ApplePlatform) => string
  xcodeSchemeDir: (platform: ApplePlatform) => string
  infoPlist: (platform: ApplePlatform) => string
  appInfoXcconfig: (platform: ApplePlatform) => string
}

type ApplePlatform = 'ios' | 'macos'
type Platform = 'android' | ApplePlatform

const PLATFORMS: Platform[] = ['android', 'ios', 'macos']

const createPaths = (project: Project): Paths => ({
  androidGradle: join(project.appDir, 'android', 'app', 'build.gradle.kts'),
  androidManifest: join(project.appDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
  xcodeProject: platform => join(project.appDir, platform, 'Runner.xcodeproj', 'project.pbxproj'),
  xcodeSchemeDir: platform => join(project.appDir, platform, 'Runner.xcodeproj', 'xcshareddata', 'xcschemes'),
  infoPlist: platform => join(project.appDir, platform, 'Runner', 'Info.plist'),
  appInfoXcconfig: platform => join(project.appDir, platform, 'Runner', 'Configs', 'AppInfo.xcconfig'),
})

const askFlavorName = async (
  initial: string | null,
  askWithDefault: (label: string, defaultValue: string) => Promise<string>,
): Promise<string> => {
  let name = initial ?? ''
  for (;;) {
    if (name === '') {
      name = await askWithDefault('flavor 名稱（小寫英數，例：uat）', 'uat')
    }
    if (FLAVOR_NAME_PATTERN.test(name)) {
      return name
    }
    console.log(`  "${name}" 不合法：須以小寫字母開頭、只含小寫字母與數字（它同時是 Gradle flavor 名、Xcode scheme 名與 <Mode>-<name> 的後綴）。`)
    name = ''
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

export const runFlavorAdd = async (project: Project, argv: string[]): Promise<void> => {
  const paths = createPaths(project)
  const appDirName = project.config.appDir

  /** 相對專案根的路徑，只用於訊息。 */
  const rel = (path: string): string => relative(project.root, path)

  /** 讀檔；不存在即中止（呼叫端已依平台目錄存在與否分流，這裡是最後防線）。 */
  const readText = (path: string): string => {
    if (!existsSync(path)) {
      throw new FlavorAddError(`找不到 ${rel(path)}。`)
    }
    return readFileSync(path, 'utf8')
  }

  const readIdentity = (platform: ApplePlatform): XcodeIdentity => {
    const appInfo = paths.appInfoXcconfig(platform)
    return readXcodeIdentity(
      readText(paths.xcodeProject(platform)),
      existsSync(appInfo) ? readFileSync(appInfo, 'utf8') : null,
    )
  }

  const applyAndroid = (flavor: GradleFlavor): string[] => {
    const gradleLabel = rel(paths.androidGradle)
    const wired = wireAndroidLabel(readText(paths.androidGradle), readText(paths.androidManifest), gradleLabel)
    const gradle = addGradleFlavor(wired.gradle, flavor, gradleLabel)
    writeFileSync(paths.androidGradle, gradle)
    if (wired.changed) {
      writeFileSync(paths.androidManifest, wired.manifest)
    }
    return [gradleLabel, ...(wired.changed ? [rel(paths.androidManifest)] : [])]
  }

  const writeXcodeScheme = (platform: ApplePlatform, flavor: XcodeFlavor): string => {
    const dir = paths.xcodeSchemeDir(platform)
    const template = join(dir, 'Runner.xcscheme')
    const target = join(dir, `${flavor.name}.xcscheme`)
    if (existsSync(target)) {
      throw new FlavorAddError(`已有 scheme ${rel(target)}，未變更任何檔案。`)
    }
    writeFileSync(target, renderXcodeScheme(readText(template), flavor.name))
    return rel(target)
  }

  const applyXcode = (platform: ApplePlatform, flavor: XcodeFlavor, fallbackDisplayName: string): string[] => {
    const projectPath = paths.xcodeProject(platform)
    const plistPath = paths.infoPlist(platform)
    // 先做存在性檢查（configuration 與 scheme），確認都能做才開始寫檔
    const original = readText(projectPath)
    if (listBuildConfigurations(original).some(block => block.name === `Release-${flavor.name}`)) {
      throw new FlavorAddError(`${platform} 已有 configuration "Release-${flavor.name}"，未變更任何檔案。`)
    }
    if (existsSync(join(paths.xcodeSchemeDir(platform), `${flavor.name}.xcscheme`))) {
      throw new FlavorAddError(`${platform} 已有 scheme ${flavor.name}.xcscheme，未變更任何檔案。`)
    }

    const wired = wireDisplayName(original, readText(plistPath), fallbackDisplayName)
    const pbxproj = addXcodeConfigurations(wired.pbxproj, flavor)
    writeFileSync(projectPath, pbxproj)
    if (wired.changed) {
      writeFileSync(plistPath, wired.plist)
    }
    const schemePath = writeXcodeScheme(platform, flavor)
    return [rel(projectPath), ...(wired.changed ? [rel(plistPath)] : []), schemePath]
  }

  const {
    askWithDefault, askYesNo, close: closePrompter,
  } = createPrompter({
    onClose: () => fail('輸入已結束，未變更任何檔案。'),
  })

  try {
    const { positional } = parseArgs(argv)
    // 偵測本機 App 目錄內有哪些原生專案可以套用
    const available: Record<Platform, boolean> = {
      android: existsSync(paths.androidGradle),
      ios: existsSync(paths.xcodeProject('ios')),
      macos: existsSync(paths.xcodeProject('macos')),
    }
    if (!available.android && !available.ios && !available.macos) {
      throw new FlavorAddError(`${appDirName}/ 內沒有 android/、ios/ 或 macos/ 原生專案，無事可做。`)
    }

    console.log('=== 建立 Flutter flavor（Android / iOS / macOS）===')
    console.log('Windows / Linux 自 Flutter 3.47 起內建 flavor，不需設定。\n')

    const name = await askFlavorName(positional[0] ?? null, askWithDefault)
    const upper = name.toUpperCase()

    // 預設值都從既有專案讀：識別字加 `.<name>` 後綴、顯示名加 ` <NAME>`
    const iosIdentity = available.ios ? readIdentity('ios') : null
    const iosPlistName = available.ios ? readPlistDisplayName(readText(paths.infoPlist('ios'))) : null
    const baseDisplayName = iosIdentity?.displayName ?? (iosPlistName === '$(APP_DISPLAY_NAME)' ? null : iosPlistName) ?? 'App'
    const displayName = await askWithDefault('顯示名稱（App 圖示下的名字）', `${baseDisplayName} ${upper}`)

    const platforms: Platform[] = []
    for (const platform of PLATFORMS) {
      if (available[platform] && await askYesNo(`套用到 ${platform}？`) === false) {
        console.log(`  略過 ${platform}。`)
        continue
      }
      if (available[platform]) {
        platforms.push(platform)
      }
    }
    if (platforms.length === 0) {
      throw new FlavorAddError('沒有選擇任何平台，未變更任何檔案。')
    }

    let applicationId = ''
    let bundleId = ''
    if (platforms.includes('android')) {
      const base = readAndroidApplicationId(readText(paths.androidGradle)) ?? 'com.example.app'
      applicationId = await askWithDefault('Android applicationId', `${base}.${name}`)
    }
    if (platforms.includes('ios') || platforms.includes('macos')) {
      const base = iosIdentity?.bundleId
        ?? readIdentity('macos').bundleId
        ?? 'com.example.app'
      bundleId = await askWithDefault('Apple bundle id（iOS / macOS 共用）', `${base}.${name}`)
    }

    const touched: string[] = []
    if (platforms.includes('android')) {
      touched.push(...applyAndroid({ name, displayName, applicationId }))
    }
    for (const platform of ['ios', 'macos'] as const) {
      if (platforms.includes(platform)) {
        touched.push(...applyXcode(platform, { name, displayName, bundleId }, baseDisplayName))
      }
    }

    console.log(`\n完成：flavor "${name}" 已寫入`)
    for (const path of touched) {
      console.log(`  ${path}`)
    }
    console.log('\n接下來：')
    console.log(`  aqutter dev --flavor=${name}            # 或 aqutter build <platform> --flavor=${name}`)
    console.log(`  aqutter build ipa --flavor=${name} --signing=signing/${name}.json   # iOS/macOS manual 簽章由 --signing 帶入，本指令不寫簽章欄位`)
    if (platforms.includes('android')) {
      console.log('  Android release 的 signingConfig 仍待接線。')
    }
    closePrompter()
  } catch (error) {
    if (error instanceof FlavorAddError) {
      return fail(error.message)
    }
    throw error
  }
}
