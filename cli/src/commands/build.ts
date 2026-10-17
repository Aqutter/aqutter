// Flutter release 打包 orchestrator：依「平台 + env 檔」產出 artifact。
//
// 與 dev 相同的單一資料源：`--env=` 指定的那一份 env 檔同時給網頁（種子）與 Flutter（dart-define）。
// 步驟：產生網頁 → syncSeed（打包種子，皆由 seed 負責）→ flutter build <t> --release --dart-define-from-file=<env 檔>
//       → 交付到 artifacts/：`<name>_<env>[_<flavor>]_<version>.<ext>`（單檔複製、目錄型產物壓 zip）
//
// 用法：aqutter build [--x-env=<name>] [--env=<env 檔路徑>] [--flavor=<name>] [--signing=<path>] [--export-options=<path>] [<platform>[,<platform>...]]
//   platform: apk | aab | ios | ipa | macos | windows | linux
//             多平台以逗號分隔（`apk,ipa`；空白分隔亦可），依輸入順序建置：種子只產一次，
//             某平台失敗續跑其餘、最後彙整並以非 0 退出。未知平台名一律中止，不會被忽略。
//             省略時進入互動選單：平台可多選、env / flavor / 簽章設定皆由掃描偵測。
//   參數順序不拘：`--key=value` 旗標放在 platform 前或後皆可（parseArgs 只認 `--key=value` 形式，
//             值必須以 `=` 綁定，`--env x` 會把 x 當成多餘的位置參數）。
//   --x-env : 預設組，一個 <name> 展開為 --env=<envDir>/.env.<name> --flavor=<name> --signing=signing/signing.<name>.json。
//             env 檔必須存在；flavor 沒建、簽章檔不存在則略過該項並印一行。明給的 --env / --flavor / --signing 優先。
//   --env   : env 檔路徑，相對專案根（預設 config 的 defaultProdEnv）。例：<envDir>/.env.uat
//             找不到即中止，不做任何退回（見 shared.resolveEnvFile）
//   --signing: 簽章設定檔路徑，相對 App 目錄（命名規範 signing/signing.<name>.json，範本 signing/signing.example.json）。
//             設定檔缺某平台區塊時該平台不簽並警告；選到的可簽平台全缺才中止。
//             ipa 改走 `flutter build ios --no-codesign` → xcodebuild archive / export（manual 簽章）；
//             macos 打包後 codesign（可選公證）；windows 打包後 signtool。未給時行為與過去相同。
//             秘密只從 process env 讀（WIN_PFX_PASSWORD），細節見 signing.ts。

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { zipSync } from 'fflate'
import type { Zippable } from 'fflate'

import type { Project } from '../config.ts'
import { chooseMany, chooseOne, listEnvFiles, listFlavors, listSigningConfigs, resolveXEnv } from '../menu.ts'
import { ENTRY_KIND, IS_WIN, StepFailure, collectEntries, createPrompter, createStep, parseArgs, readAppVersion } from '../shared.ts'
import { resolveEnvironment } from '../environments.ts'
import type { WalkEntry } from '../shared.ts'
import { archiveAndExportIpa, readSigningConfig, signMacosApp, signWindowsExe, signingSectionOf } from '../signing.ts'
import type { SigningPlatformKey } from '../signing.ts'
import { runSeed } from './seed.ts'

const TAG = 'build'

// platform 別名 → `flutter build` 子命令
export const FLUTTER_TARGET: Record<string, string> = {
  apk: 'apk',
  aab: 'appbundle',
  ios: 'ios',
  ipa: 'ipa',
  macos: 'macos',
  windows: 'windows',
  linux: 'linux',
}

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

/** 單一平台建置途中的錯誤（找不到產物等）：丟出讓多平台迴圈續跑其餘，單平台則在頂層 exit 1。 */
export class BuildError extends Error {
  constructor(message: string) {
    super(`[${TAG}] ${message}`)
    this.name = 'BuildError'
  }
}

// Flutter 各平台的固定產物位置（相對 App 目錄的 build/）。flavor 會改變 Android 的路徑與檔名、
// macOS 的 Products 子目錄，以及 Windows / Linux 的 runner 上層子目錄（Flutter 3.47 起桌面內建 flavor，
// 產物隔離到 `<arch>/<flavor>/…`）；ipa / ios 不受影響。
// Windows / Linux 的產物目錄帶架構名（x64 / arm64），依執行 CLI 的機器架構決定——Flutter 桌面不支援
// 交叉編譯，產物架構必然等於建置機架構。
// Node 的 process.arch 與 Flutter 桌面（Windows / Linux）輸出子目錄名對照
const DESKTOP_ARCH = process.arch === 'arm64' ? 'arm64' : 'x64'

export interface Product {
  kind: 'file' | 'dir'
  path: string | null
  expected: string
}

/** 在目錄內找唯一一個符合副檔名的項目；找不到或不只一個都回 null，讓呼叫端把預期路徑印出來。 */
const findSingle = (dir: string, extension: string): string | null => {
  if (!existsSync(dir)) {
    return null
  }
  const matches = readdirSync(dir).filter(entry => entry.endsWith(extension))
  return matches.length === 1 ? join(dir, matches[0]) : null
}

/**
 * 依平台解析產物來源：`kind` 為 `file`（直接複製）或 `dir`（壓成 zip）；
 * 來源不存在時 `path` 為 null，`expected` 供錯誤訊息印出預期位置。
 */
export const locateProduct = (project: Project, target: string, flavorName: string | null): Product => {
  const buildDir = join(project.appDir, 'build')
  switch (target) {
    case 'apk': {
      const file = join(buildDir, 'app', 'outputs', 'flutter-apk', flavorName ? `app-${flavorName}-release.apk` : 'app-release.apk')
      return {
        kind: 'file',
        path: existsSync(file) ? file : null,
        expected: file,
      }
    }
    case 'aab': {
      const file = flavorName
        ? join(buildDir, 'app', 'outputs', 'bundle', `${flavorName}Release`, `app-${flavorName}-release.aab`)
        : join(buildDir, 'app', 'outputs', 'bundle', 'release', 'app-release.aab')
      return {
        kind: 'file',
        path: existsSync(file) ? file : null,
        expected: file,
      }
    }
    case 'ipa': {
      const dir = join(buildDir, 'ios', 'ipa')
      return {
        kind: 'file',
        path: findSingle(dir, '.ipa'),
        expected: join(dir, '*.ipa'),
      }
    }
    case 'ios': {
      const dir = join(buildDir, 'ios', 'iphoneos', 'Runner.app')
      return {
        kind: 'dir',
        path: existsSync(dir) ? dir : null,
        expected: dir,
      }
    }
    case 'macos': {
      const dir = join(buildDir, 'macos', 'Build', 'Products', flavorName ? `Release-${flavorName}` : 'Release')
      return {
        kind: 'dir',
        path: findSingle(dir, '.app'),
        expected: join(dir, '*.app'),
      }
    }
    case 'windows': {
      const dir = join(buildDir, 'windows', DESKTOP_ARCH, ...(flavorName ? [flavorName] : []), 'runner', 'Release')
      return {
        kind: 'dir',
        path: existsSync(dir) ? dir : null,
        expected: dir,
      }
    }
    case 'linux': {
      const dir = join(buildDir, 'linux', DESKTOP_ARCH, ...(flavorName ? [flavorName] : []), 'release', 'bundle')
      return {
        kind: 'dir',
        path: existsSync(dir) ? dir : null,
        expected: dir,
      }
    }
    default:
      return {
        kind: 'file',
        path: null,
        expected: `(未知平台 ${target})`,
      }
  }
}

/** 交付檔名（不含副檔名）：`<name>_<env>[_<flavor>]_<version>`。 */
export const artifactStem = (name: string, envName: string, flavorName: string | null, version: string): string => {
  return [name, envName, flavorName, version].filter(Boolean).join('_')
}

// zip 條目的 unix 屬性（PKZIP APPNOTE 4.4.2.2 / 4.4.15）：`os` 3 = Unix，
// `attrs` 高 16 位元放 st_mode。Info-ZIP `unzip` 與 macOS Archive Utility 都依此還原 symlink 與權限。
const ZIP_OS_UNIX = 3
const UNIX_MODE_SHIFT = 16
// 型別位固定給定，不信任 lstat 回的型別位；權限位只取 rwx 三組（含 setuid/sticky 的 0o7777）。
const UNIX_TYPE_FILE = 0o100000
const UNIX_TYPE_SYMLINK = 0o120000
const UNIX_PERMISSION_MASK = 0o7777
const SYMLINK_PERMISSION = 0o755

/** 把 unix mode 組成 fflate 的 `attrs`（`<< 16` 會溢出成負的 int32，`>>> 0` 轉回無號）。 */
const unixAttrs = (mode: number): number => {
  return (mode << UNIX_MODE_SHIFT) >>> 0
}

type ZipEntry = Zippable[string]

/**
 * 產生單一 zip 條目。非 Windows 才帶 unix 屬性：Windows 上 `lstat.mode` 沒有意義、也不會有
 * symlink，而 macos / ios 產物只能在 macOS 建置、linux 只能在 Linux 建置、windows 只在 Windows
 * 建置，故以執行 CLI 的平台判定即等價於產物平台，且不會讓 Windows 的 zip 多出一組假的 unix
 * 屬性（維持原行為）。
 */
const zipEntryOf = (entry: WalkEntry): ZipEntry => {
  if (IS_WIN) {
    return new Uint8Array(readFileSync(entry.path))
  }
  if (entry.kind === ENTRY_KIND.symlink) {
    // zip 的 symlink 語意：內容即連結目標路徑。目標字串短到不值得壓縮，與 Info-ZIP 產出一致。
    return [
      new TextEncoder().encode(readlinkSync(entry.path)),
      {
        os: ZIP_OS_UNIX,
        attrs: unixAttrs(UNIX_TYPE_SYMLINK | SYMLINK_PERMISSION),
        level: 0,
      },
    ]
  }
  return [
    new Uint8Array(readFileSync(entry.path)),
    {
      os: ZIP_OS_UNIX,
      attrs: unixAttrs(UNIX_TYPE_FILE | (entry.mode & UNIX_PERMISSION_MASK)),
    },
  ]
}

/**
 * 把目錄壓成 zip，zip 內以該目錄名為根（解壓後得到 `Runner.app/…`、`Release/…`），
 * 與 syncSeed 同用 fflate——不依賴 `tar -a` / `zip` CLI，兩者在 Windows 與 macOS 上行為不一致。
 * symlink 保留為連結、檔案保留權限位（見 zipEntryOf）：`.app` 的 framework 靠 `Versions/Current`
 * 這類連結組成，主執行檔要有 +x，兩者任一缺失解壓後都無法啟動、codesign 也驗不過。
 */
const zipDirectory = (dir: string, destination: string): void => {
  const rootName = basename(dir)
  const entries: Zippable = {}
  for (const entry of collectEntries(dir)) {
    const name = `${rootName}/${relative(dir, entry.path).split('\\').join('/')}`
    entries[name] = zipEntryOf(entry)
  }
  writeFileSync(destination, zipSync(entries))
}

/** 打包成功後把產物交付到 artifacts/；回傳交付路徑。 */
const publishArtifact = (project: Project, target: string, envName: string, flavorName: string | null, version: string): string => {
  const product = locateProduct(project, target, flavorName)
  if (!product.path) {
    throw new BuildError(`打包完成但找不到產物：${product.expected}`)
  }

  mkdirSync(project.artifactsDir, { recursive: true })
  const stem = artifactStem(project.config.artifactName, envName, flavorName, version)

  if (product.kind === 'file') {
    const destination = join(project.artifactsDir, `${stem}.${target}`)
    copyFileSync(product.path, destination)
    return destination
  }

  const destination = join(project.artifactsDir, `${stem}_${target}.zip`)
  zipDirectory(product.path, destination)
  return destination
}

/** 依序執行；任一步失敗即中止（丟 StepFailure，由呼叫端決定續跑或退出）。 */
const step = createStep(TAG)

// `--signing` 對應到各平台區塊：ipa 走 ios 區塊；ios（.app）非交付形態、apk/aab 走 Gradle 自己的
// 簽章設定、linux 沒有簽章概念——這些平台給了 --signing 只警告不中止，避免捷徑組合時誤傷。
export const SIGNING_SECTION: Record<string, SigningPlatformKey | undefined> = {
  ipa: 'ios',
  macos: 'macos',
  windows: 'windows',
}

// 互動選單可選的平台，依建置機過濾：Apple 平台只能在 macOS 建、桌面不交叉編譯。
export const HOST_PLATFORMS: Record<string, string[]> = {
  darwin: ['apk', 'aab', 'ios', 'ipa', 'macos'],
  win32: ['apk', 'aab', 'windows'],
  linux: ['apk', 'aab', 'linux'],
}
export const PLATFORM_LABEL: Record<string, string> = {
  apk: 'Android APK',
  aab: 'Android App Bundle',
  ios: 'iOS .app（不簽、非交付形態）',
  ipa: 'iOS IPA',
  macos: 'macOS .app',
  windows: 'Windows',
  linux: 'Linux',
}

interface BuildOneOptions {
  platform: string
  envFile: string
  envName: string
  appVersion: string
  flavor: string | null
  signingPath: string | null
  exportOptions: string | null
}

/**
 * 建置單一平台（種子已由呼叫端產好）：flutter build → 可選手動簽章 → 交付到 artifacts/。
 * 回傳交付路徑；失敗丟 StepFailure / BuildError。
 */
const buildOne = (project: Project, {
  platform, envFile, envName, appVersion, flavor, signingPath, exportOptions,
}: BuildOneOptions): string => {
  // 簽章設定在打包前就先讀完：缺檔、缺欄位別等十幾分鐘的 build 跑完才發現。
  // 區塊缺席（signingSectionOf 回 null）＝該平台不簽，走與未給 --signing 相同的路徑；先驗已印過警告。
  let signing: ReturnType<typeof signingSectionOf> = null
  if (signingPath) {
    const section = SIGNING_SECTION[platform]
    if (section) {
      signing = signingSectionOf(readSigningConfig(project, signingPath), signingPath, section)
    }
    else {
      console.warn(`[${TAG}] 平台 ${platform} 不套用 --signing（僅 ipa / macos / windows），已忽略。`)
    }
  }

  // flutter build（release，帶同一 env 檔；可選 flavor / export-options）
  // 手動簽章的 ipa 例外：Flutter 沒有把 manual 簽章帶進 archive 的旗標，故改跑 `build ios --no-codesign`
  // （只為寫出含 dart-define 的 Generated.xcconfig 並完成 Flutter 端組譯），archive / export 交給 xcodebuild。
  const signedIpa = signing !== null && platform === 'ipa'
  const buildTarget = signedIpa ? 'ios' : FLUTTER_TARGET[platform]
  const buildArgs = ['build', buildTarget, '--release', `--dart-define-from-file=${join(project.root, envFile)}`]
  if (flavor) {
    buildArgs.push('--flavor', flavor)
  }
  if (signedIpa) {
    buildArgs.push('--no-codesign')
  }
  else if (exportOptions) {
    // 僅 ipa 匯出階段適用（method=enterprise/ad-hoc/app-store、team、憑證、描述檔）
    buildArgs.push(`--export-options-plist=${join(project.appDir, exportOptions)}`)
  }
  step(`flutter build ${buildTarget}`, 'flutter', buildArgs, project.appDir)

  // 手動簽章：ipa 在此 archive + export；macos / windows 對打包完成的產物就地簽，之後才交付
  if (signedIpa) {
    archiveAndExportIpa(project, signing as NonNullable<ReturnType<typeof signingSectionOf<'ios'>>>, {
      flavor,
      exportOptionsPath: exportOptions,
    })
  }
  else if (signing !== null) {
    const product = locateProduct(project, platform, flavor)
    if (!product.path) {
      throw new BuildError(`打包完成但找不到要簽章的產物：${product.expected}`)
    }
    if (platform === 'macos') {
      signMacosApp(project, signing as NonNullable<ReturnType<typeof signingSectionOf<'macos'>>>, product.path)
    }
    else {
      signWindowsExe(project, signing as NonNullable<ReturnType<typeof signingSectionOf<'windows'>>>, product.path)
    }
  }

  // 交付：複製／壓縮到 artifacts/，檔名帶 env、flavor 與版本
  return publishArtifact(project, platform, envName, flavor, appVersion)
}

interface Selection {
  platforms: string[]
  envPath: string
  flavor: string | null
  signingPath: string | null
}

interface Preset {
  envPath: string | null
  flavor: string | null
  signingPath: string | null
}

/**
 * 互動選單：平台多選 → env → flavor → 簽章設定 → 確認。旗標（含 --x-env 展開）已給的項目不再問。
 * 回傳 { platforms, envPath, flavor, signingPath }。
 */
const promptSelections = async (project: Project, preset: Preset): Promise<Selection> => {
  const prompter = createPrompter({
    onClose: () => fail('輸入已結束，未執行任何建置。'),
  })
  const hostPlatforms = HOST_PLATFORMS[process.platform] ?? ['apk', 'aab']
  const platforms = (await chooseMany(
    prompter,
    `請選擇要建置的平台（本機 ${process.platform} 可建）：`,
    hostPlatforms.map(platform => ({
      label: `${platform.padEnd(8)}${PLATFORM_LABEL[platform]}`,
      platform,
    })),
  )).map(option => option.platform)

  let envPath = preset.envPath
  if (envPath === null) {
    const envFiles = listEnvFiles(project)
    if (envFiles.length === 0) {
      fail(`${project.config.envDir}/ 下沒有任何 env 檔（.env.example 除外），請由 ${project.config.envDir}/.env.example 複製一份。`)
    }
    const defaultIndex = Math.max(0, envFiles.findIndex(env => env.path === project.config.defaultProdEnv))
    envPath = (await chooseOne(
      prompter,
      '請選擇 env 檔：',
      envFiles.map(env => ({
        label: `${env.name.padEnd(12)}${env.path}`,
        path: env.path,
      })),
      defaultIndex,
    )).path
  }

  let flavor = preset.flavor
  if (flavor === null) {
    const flavors = listFlavors(project)
    if (flavors.length > 0) {
      flavor = (await chooseOne<{ label: string, name: string | null }>(
        prompter,
        '請選擇 flavor：',
        [
          {
            label: '（不用 flavor）',
            name: null,
          },
          ...flavors.map(entry => ({
            label: `${entry.name.padEnd(12)}已建於 ${entry.platforms.join(' / ')}`,
            name: entry.name,
          })),
        ],
        0,
      )).name
    }
  }

  let signingPath = preset.signingPath
  const signable = platforms.some(platform => SIGNING_SECTION[platform])
  if (signingPath === null && signable) {
    const configs = listSigningConfigs(project)
    if (configs.length > 0) {
      signingPath = (await chooseOne<{ label: string, path: string | null }>(
        prompter,
        '請選擇簽章設定檔（ipa / macos / windows 適用）：',
        [
          {
            label: '（不簽章）',
            path: null,
          },
          ...configs.map(entry => ({
            label: `${entry.path.padEnd(28)}涵蓋 ${entry.platforms.join(' / ') || '（無平台區塊）'}`,
            path: entry.path,
          })),
        ],
        0,
      )).path
    }
  }

  console.log('\n將依序建置：')
  console.log(`  平台   : ${platforms.join(', ')}`)
  console.log(`  env    : ${envPath}`)
  console.log(`  flavor : ${flavor ?? '（無）'}`)
  console.log(`  簽章   : ${signingPath ?? '（無）'}`)
  if (!(await prompter.askYesNo('確認開始？'))) {
    fail('已取消，未執行任何建置。')
  }
  prompter.close()
  return {
    platforms,
    envPath,
    flavor,
    signingPath,
  }
}

interface PlatformResult {
  platform: string
  artifact?: string
  error?: string
}

export const runBuild = async (project: Project, argv: string[]): Promise<void> => {
  const {
    positional, flags,
  } = parseArgs(argv)
  const exportOptions = flags['export-options'] ?? null // ipa 匯出設定（企業簽 method=enterprise 等）

  // 位置參數是平台清單：`apk,ipa` 與 `apk ipa` 等價，去重後依輸入順序建置。
  // 未知名稱一律中止而非忽略——`apk uat` 這種把 env 當平台的誤用，靜默丟棄比報錯危險。
  const requested = [...new Set(positional.flatMap(arg => arg.split(',')).filter(Boolean))]
  const unknown = requested.filter(platform => !FLUTTER_TARGET[platform])
  if (unknown.length > 0) {
    fail(`未知平台「${unknown.join('」「')}」：${Object.keys(FLUTTER_TARGET).join(' | ')}（省略即進互動選單）。`)
  }

  // --x-env=<name> 展開為 env / flavor / signing 三項（明給的旗標優先）；未指定者為 null
  const preset = resolveXEnv(project, flags, {
    tag: TAG,
    withSigning: true,
  })

  // 有位置參數：非互動路徑；沒有：互動選單（可多選）
  const selection: Selection = requested.length > 0
    ? {
        platforms: requested,
        envPath: preset.envPath ?? project.config.defaultProdEnv, // 環境一律用 --env=<env 檔路徑> 或 --x-env=<name>
        flavor: preset.flavor, // Flutter flavor（iOS scheme + Android productFlavor）
        signingPath: preset.signingPath, // 簽章設定檔（相對 App 目錄）；見 signing.ts
      }
    : await promptSelections(project, preset)
  const {
    platforms, envPath,
  } = selection

  // --env / -e 的值可以是設定檔的環境名，或 env 檔路徑；環境名會帶入該環境設定的 flavor 與簽章（旗標優先）
  const resolvedEnvironment = resolveEnvironment(project, envPath)
  if (!resolvedEnvironment.ok) {
    return fail(resolvedEnvironment.error)
  }
  const environment = resolvedEnvironment.value
  const envFile = environment.envFile
  const flavor = selection.flavor ?? environment.flavor
  const signingPath = selection.signingPath ?? environment.signing

  // 交付檔名的兩個要素在打包前就先確認，別等十幾分鐘的 build 跑完才發現組不出檔名。
  const envName = environment.name
  if (!envName) {
    return fail(`無法由 env 檔 \`${envFile}\` 推導環境名（檔名須為 .env.<環境> 形式，例如 ${project.config.envDir}/.env.uat，或在 aqutter.config.json 的 environments 命名）。`)
  }
  const appVersion = readAppVersion(project)
  if (!appVersion) {
    return fail(`${project.config.appDir}/pubspec.yaml 找不到 \`version:\`，無法組出產物檔名。`)
  }

  console.log(
    `[${TAG}] platform=${platforms.join(',')} env=${envFile}`
    + `${flavor ? ` flavor=${flavor}` : ''}${exportOptions ? ` export-options=${exportOptions}` : ''}`
    + `${signingPath ? ` signing=${signingPath}` : ''}`,
  )

  // 0) 簽章設定先驗：缺檔、壞 JSON、有區塊但缺欄位，在任何 build 開始前就中止。
  //    區塊缺席的平台只警告、不簽（同一台 Mac 上 ipa 企業簽而 macos 不簽是真實情境）；
  //    但選到的可簽平台**全部**缺席代表整份設定檔對不上，仍中止——那不是「不想簽」，是給錯檔。
  //    buildOne 內再讀一次是為了取該平台的區塊，成本可忽略。
  if (signingPath) {
    const signable = platforms.filter(entry => SIGNING_SECTION[entry])
    const config = readSigningConfig(project, signingPath)
    const unsigned = signable.filter(platform => signingSectionOf(config, signingPath, SIGNING_SECTION[platform] as SigningPlatformKey) === null)
    for (const platform of unsigned) {
      console.warn(`[${TAG}] 簽章設定檔 \`${signingPath}\` 沒有 \`${SIGNING_SECTION[platform]}\` 區塊，平台 ${platform} 不簽章。`)
    }
    if (signable.length > 0 && unsigned.length === signable.length) {
      fail(`簽章設定檔 \`${signingPath}\` 沒有任何選到平台的區塊（${signable.map(platform => SIGNING_SECTION[platform]).join(' / ')}）。`)
    }
  }

  // 1) 產生種子網頁包（委派 seed，傳解析後的路徑而非原始輸入——seed 不必再解析一次）。
  //    多平台共用同一份 env，種子只產一次；種子失敗沒有任何平台能建，直接退出。
  try {
    await runSeed(project, [`--env=${environment.source === 'config' ? envName : envFile}`])
  }
  catch (error) {
    if (error instanceof StepFailure) {
      process.exit(1)
    }
    throw error
  }

  // 2) 逐平台建置；某平台失敗續跑其餘，結束時彙整
  const results: PlatformResult[] = []
  for (const platform of platforms) {
    console.log(`\n[${TAG}] ===== ${platform} =====`)
    try {
      const artifact = buildOne(project, {
        platform,
        envFile,
        envName,
        appVersion,
        flavor,
        signingPath,
        exportOptions,
      })
      results.push({
        platform,
        artifact: relative(project.root, artifact),
      })
    }
    catch (error) {
      if (!(error instanceof StepFailure) && !(error instanceof BuildError)) {
        throw error
      }
      console.error(error.message)
      results.push({
        platform,
        error: error.message,
      })
    }
  }

  const failed = results.filter(result => result.error)
  if (platforms.length === 1 && failed.length === 0) {
    console.log(`\n[${TAG}] 完成：${platforms[0]}（env=${envFile}${flavor ? `, flavor=${flavor}` : ''}）→ ${results[0].artifact}`)
    return
  }
  console.log(`\n[${TAG}] 結果（env=${envFile}${flavor ? `, flavor=${flavor}` : ''}）：`)
  for (const result of results) {
    console.log(result.error ? `  ❌ ${result.platform.padEnd(8)}${result.error}` : `  ✅ ${result.platform.padEnd(8)}${result.artifact}`)
  }
  if (failed.length > 0) {
    process.exit(1)
  }
}
