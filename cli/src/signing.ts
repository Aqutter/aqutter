// build 的手動簽章：由 `--signing=<path>` 指定的設定檔驅動，未給時 build 不會呼叫本檔。
//
// 設定檔（相對 App 目錄，可進版控、不含秘密）只讀取與本次平台對應的區塊：
//   ios     : { method, teamId, certificate, profile, bundleId }
//   macos   : { identity, notaryProfile? }
//   windows : { pfx | thumbprint, timestampUrl? }
// 秘密一律從 process env 讀：WIN_PFX_PASSWORD（pfx 密碼）。macOS 公證憑證由
// `xcrun notarytool store-credentials <notaryProfile>` 事先存入 keychain；iOS 憑證／描述檔的匯入
// 屬本機或 CI 的環境準備，不在 CLI 範圍。
//
// 缺檔、缺欄位一律中止並指出缺什麼——不退回、不猜（與 resolveEnvFile 同一紀律）：
// 簽錯身分的產物裝得上、看不出來，是最難察覺的一類錯誤。

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Project } from './config.ts'
import { createStep } from './shared.ts'

const TAG = 'sign'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

const step = createStep(TAG)

export type SigningPlatformKey = 'ios' | 'macos' | 'windows'

export interface IosSigning {
  method: string
  teamId: string
  certificate: string
  profile: string
  bundleId: string
}

export interface MacosSigning {
  identity: string
  notaryProfile?: string
}

export interface WindowsSigning {
  pfx?: string
  thumbprint?: string
  timestampUrl?: string
}

export interface SigningSections {
  ios: IosSigning
  macos: MacosSigning
  windows: WindowsSigning
}

export type SigningConfig = Partial<Record<SigningPlatformKey, Record<string, unknown>>>

// 各平台區塊的必填欄位；windows 的 pfx / thumbprint 二擇一，另行檢查。
export const REQUIRED_FIELDS: Record<SigningPlatformKey, string[]> = {
  ios: ['method', 'teamId', 'certificate', 'profile', 'bundleId'],
  macos: ['identity'],
  windows: [],
}

// 時間戳伺服器：未指定時用 DigiCert（免費、與 signtool 文件範例一致）。
const DEFAULT_TIMESTAMP_URL = 'http://timestamp.digicert.com'

/**
 * xcodebuild 的 archive / export 工作目錄（相對 App 目錄的 build/ios）。export 目錄沿用
 * `flutter build ipa` 的慣例位置，讓 build 的 locateProduct('ipa') 不必分辨兩條路徑。
 */
const iosPaths = (project: Project) => {
  const buildDir = join(project.appDir, 'build', 'ios')
  return {
    buildDir,
    archive: join(buildDir, 'archive', 'Runner.xcarchive'),
    exportDir: join(buildDir, 'ipa'),
    exportOptions: join(buildDir, 'ExportOptions.plist'),
  }
}

/**
 * 讀取整份簽章設定檔。檔案不存在或 JSON 壞掉直接中止——這兩種是「設定檔本身不對」，
 * 與「某平台沒寫區塊」不同，後者交由 signingSectionOf 決定要不要跳過。
 */
export const readSigningConfig = (project: Project, signingPath: string): SigningConfig => {
  const file = join(project.appDir, signingPath)
  if (!existsSync(file)) {
    return fail(`找不到簽章設定檔 \`${signingPath}\`（\`--signing=\` 吃的是相對 ${project.config.appDir}/ 的路徑，範本見 ${project.config.appDir}/signing/signing.example.json）。`)
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as SigningConfig
  }
  catch (error) {
    return fail(`簽章設定檔 \`${signingPath}\` 不是合法 JSON：${(error as Error).message}`)
  }
}

/**
 * 取 `platformKey`（ios / macos / windows）那一個區塊。區塊缺席回 null（呼叫端據此跳過該平台的簽章）；
 * 區塊存在但缺欄位仍中止——寫了一半的區塊是設定錯誤，不是「不想簽」。
 */
export function signingSectionOf<K extends SigningPlatformKey>(config: SigningConfig, signingPath: string, platformKey: K): SigningSections[K] | null {
  const section = config[platformKey]
  if (!section || typeof section !== 'object') {
    return null
  }
  const missing = REQUIRED_FIELDS[platformKey].filter(key => !section[key])
  if (platformKey === 'windows' && !section.pfx && !section.thumbprint) {
    missing.push('pfx 或 thumbprint（二擇一）')
  }
  if (missing.length > 0) {
    fail(`簽章設定檔 \`${signingPath}\` 的 \`${platformKey}\` 區塊缺欄位：${missing.join('、')}。`)
  }
  return section as unknown as SigningSections[K]
}

/** 把字串放進 plist `<string>`：只需跳脫 XML 的三個保留字元。 */
const xmlEscape = (value: unknown): string => {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 由 ios 區塊產生 ExportOptions.plist：
 * manual 簽章、指定 team / 憑證，以 bundleId → profile 對應描述檔。
 */
export const renderExportOptions = (ios: IosSigning): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>method</key>
  <string>${xmlEscape(ios.method)}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>${xmlEscape(ios.teamId)}</string>
  <key>signingCertificate</key>
  <string>${xmlEscape(ios.certificate)}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${xmlEscape(ios.bundleId)}</key>
    <string>${xmlEscape(ios.profile)}</string>
  </dict>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
`
}

/**
 * iOS 手動簽章 IPA：與 `cap build ios --xcode-signing-style manual …` 同構。
 * 呼叫端已先跑 `flutter build ios --no-codesign`（寫出含 dart-define 的 Generated.xcconfig），
 * 這裡接手 archive（manual 簽章設定以 build settings 帶入，不改 pbxproj）與 export。
 * `exportOptionsPath`（`--export-options=`，相對 App 目錄）有給就用它、不自動產生。
 * 產物落在 build/ios/ipa/*.ipa，與 `flutter build ipa` 相同。
 */
export const archiveAndExportIpa = (project: Project, ios: IosSigning, {
  flavor, exportOptionsPath,
}: { flavor: string | null, exportOptionsPath: string | null }): void => {
  const paths = iosPaths(project)
  const scheme = flavor ?? 'Runner'
  const configuration = flavor ? `Release-${flavor}` : 'Release'
  step('xcodebuild archive', 'xcodebuild', [
    '-workspace', join(project.appDir, 'ios', 'Runner.xcworkspace'),
    '-scheme', scheme,
    '-configuration', configuration,
    '-archivePath', paths.archive,
    'archive',
    'CODE_SIGN_STYLE=Manual',
    `DEVELOPMENT_TEAM=${ios.teamId}`,
    `PROVISIONING_PROFILE_SPECIFIER=${ios.profile}`,
    `CODE_SIGN_IDENTITY=${ios.certificate}`,
  ], project.appDir)

  let exportOptions = paths.exportOptions
  if (exportOptionsPath) {
    exportOptions = join(project.appDir, exportOptionsPath)
  }
  else {
    mkdirSync(paths.buildDir, { recursive: true })
    writeFileSync(exportOptions, renderExportOptions(ios))
    console.log(`[${TAG}] 已由簽章設定產生 ${exportOptions}`)
  }
  step('xcodebuild -exportArchive', 'xcodebuild', [
    '-exportArchive',
    '-archivePath', paths.archive,
    '-exportOptionsPlist', exportOptions,
    '-exportPath', paths.exportDir,
  ], project.appDir)
}

/**
 * macOS：以 Developer ID 對 `.app` 簽章（hardened runtime + 時間戳，公證的前提），
 * 設定檔有 notaryProfile 才送公證並 staple——沒有就只簽。呼叫端在本函式之後才交付，
 * 交付的 zip 因此含 staple 票證。
 */
export const signMacosApp = (project: Project, macos: MacosSigning, appPath: string): void => {
  step('codesign', 'codesign', [
    '--force', '--deep', '--options', 'runtime', '--timestamp',
    '--entitlements', join(project.appDir, 'macos', 'Runner', 'Release.entitlements'),
    '--sign', macos.identity,
    appPath,
  ], project.appDir)

  if (!macos.notaryProfile) {
    return
  }
  // notarytool 只收 zip / dmg / pkg；ditto 是 Apple 文件指定的壓法（保留 bundle 結構與 xattr）。
  const notaryZip = `${appPath}.notary.zip`
  step('ditto（公證用 zip）', 'ditto', ['-c', '-k', '--keepParent', appPath, notaryZip], project.appDir)
  step('notarytool submit', 'xcrun', ['notarytool', 'submit', notaryZip, '--keychain-profile', macos.notaryProfile, '--wait'], project.appDir)
  step('stapler staple', 'xcrun', ['stapler', 'staple', appPath], project.appDir)
}

/**
 * Windows：對 Release 目錄內的 `.exe` 逐一 `signtool sign`（SHA256 + RFC 3161 時間戳）。
 * 憑證來源二擇一：`pfx`（相對 App 目錄，密碼從 WIN_PFX_PASSWORD 讀）或 `thumbprint`
 * （已匯入 Windows 憑證存放區）。signtool 隨 Windows SDK 安裝，不在 PATH 時由 step 的
 * spawn 失敗（ENOENT）中止。
 */
export const signWindowsExe = (project: Project, windows: WindowsSigning, releaseDir: string): void => {
  const executables = readdirSync(releaseDir).filter(name => name.toLowerCase().endsWith('.exe'))
  if (executables.length === 0) {
    fail(`Release 目錄沒有可簽的 .exe：${releaseDir}`)
  }

  const certificateArgs: string[] = []
  if (windows.pfx) {
    const password = process.env.WIN_PFX_PASSWORD
    if (!password) {
      fail('簽章設定使用 pfx，但 process env 沒有 WIN_PFX_PASSWORD。')
    }
    certificateArgs.push('/f', join(project.appDir, windows.pfx), '/p', password as string)
  }
  else {
    certificateArgs.push('/sha1', windows.thumbprint as string)
  }

  // 密碼不進 log：step 只遮蔽印出的命令列，傳給 signtool 的仍是原值
  const secrets = process.env.WIN_PFX_PASSWORD ? [process.env.WIN_PFX_PASSWORD] : []
  for (const name of executables) {
    step(`signtool sign ${name}`, 'signtool', [
      'sign',
      '/fd', 'SHA256',
      '/td', 'SHA256',
      '/tr', windows.timestampUrl ?? DEFAULT_TIMESTAMP_URL,
      ...certificateArgs,
      join(releaseDir, name),
    ], project.appDir, secrets)
  }
}
