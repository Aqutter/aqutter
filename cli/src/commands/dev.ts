// Flutter dev orchestrator：同跑網頁 dev server + `flutter run`，並依「目標平台」處理連線差異。
//
// 單一資料源：`--env=` 指定的那一份 env 檔同時餵給兩端——
//   - 網頁：由框架轉接器帶入（見 web.ts；Nuxt 為 `--dotenv`，其餘注入子行程環境）
//   - Flutter：`flutter run --dart-define-from-file=<env 檔路徑>`（→ String.fromEnvironment）
// 連線用的 AQUTTER_DEV_URL 由本指令依目標平台計算後以 CLI `--dart-define` 覆蓋（CLI > file）。
//
// 用法：aqutter dev [target] [--x-env=<name>] [--env=<env 檔路徑>] [--flavor=<name>] [--port=<n>]
//   target : 省略 / pick（互動選單，全平台）| ios（互動·iOS 範圍）| android（互動·Android 範圍）
//            | macos | windows | linux | ios-device | <flutter device id>
//   --x-env: 預設組，一個 <name> 展開為 --env=<envDir>/.env.<name> --flavor=<name>（env 檔必須存在；flavor 沒建則略過並印一行）。
//            明給的 --env / --flavor 優先。
//   --env  : env 檔路徑，相對專案根（預設為設定的 defaultDevEnv）。例：.env/.env.uat
//            找不到即中止，不做任何退回（見 shared.resolveEnvFile）
//   --port : dev server 埠（預設為設定的 defaultPort）。本指令算出的埠同時餵給 AQUTTER_DEV_URL、adb reverse、
//            dev server 的 port 參數，並以 env DEV_PORT 交棒給網頁專案的設定（CSP 與 HMR）。
//   參數順序不拘：`--key=value` 旗標放在 target 前或後皆可（parseArgs 只認 `--key=value` 形式，
//            值必須以 `=` 綁定，`--env x` 會把 x 當成 target）。
// 互動選單同時列出：執行中的裝置（模擬器 + 實機）、可開機的 iOS 模擬器（xcrun simctl）、
//                   可開機的 Android 模擬器（flutter emulators）。選未開機者會自動 boot。

import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'

import type { Project } from '../config.ts'
import { IS_WIN, createPrompter, ensureSeedDir, parseArgs, resolvePort } from '../shared.ts'
import { resolveEnvironment } from '../environments.ts'
import type { Prompter } from '../shared.ts'
import { chooseOne, listEnvFiles, listFlavors, resolveXEnv } from '../menu.ts'
import { createWebAdapter } from '../web.ts'

const TAG = 'flutter:dev'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

type DeviceKind = 'desktop' | 'android' | 'sim' | 'ios-device' | 'other'
type Scope = 'all' | 'ios' | 'android'

/** `flutter devices --machine` 的單筆輸出（只列用到的欄位）。 */
interface FlutterDevice {
  id: string
  name: string
  targetPlatform?: string
  emulator?: boolean
}

interface BootRequest {
  type: 'emu' | 'sim'
  id?: string
  udid?: string
}

interface TargetOption {
  label: string
  kind: DeviceKind
  deviceId?: string
  boot: BootRequest | null
}

interface ResolvedTarget {
  deviceId: string
  kind: DeviceKind
}

const isIos = (device: FlutterDevice): boolean => device.targetPlatform?.startsWith('ios') ?? false
const isAndroid = (device: FlutterDevice): boolean => device.targetPlatform?.startsWith('android') ?? false

// `flutter devices --machine` 的桌面 targetPlatform（macOS=darwin、Windows=windows-x64、Linux=linux-x64）
const DESKTOP_PLATFORMS = new Set(['darwin', 'windows-x64', 'linux-x64'])
const isDesktop = (device: FlutterDevice): boolean => DESKTOP_PLATFORMS.has(device.targetPlatform ?? '')

const deviceKind = (device: FlutterDevice): DeviceKind => {
  if (isDesktop(device)) {
    return 'desktop'
  }
  if (isAndroid(device)) {
    return 'android'
  }
  if (isIos(device)) {
    return device.emulator ? 'sim' : 'ios-device'
  }
  return 'other'
}

const findAdb = (): string => {
  const candidates = [
    join(process.env.HOME ?? '', 'Library/Android/sdk/platform-tools/adb'),
    join(process.env.HOME ?? '', 'Android/Sdk/platform-tools/adb'),
  ]
  return candidates.find(path => existsSync(path)) ?? 'adb'
}

const lanIp = (): string | null => {
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return null
}

// 桌面 target 名即 flutter device id（macos / windows / linux）
const DESKTOP_TARGETS = new Set(['macos', 'windows', 'linux'])

export const runDev = async (project: Project, argv: string[]): Promise<void> => {
  const appDir = project.appDir
  const config = project.config

  // ---- 裝置查詢 ----
  const listDevices = (): FlutterDevice[] => {
    const result = spawnSync('flutter', ['devices', '--machine'], {
      cwd: appDir,
      encoding: 'utf8',
      shell: IS_WIN,
    })
    try {
      return JSON.parse(result.stdout) as FlutterDevice[]
    }
    catch {
      return []
    }
  }

  // ---- 可開機的模擬器列舉 ----
  /** `flutter emulators` 文字輸出 → [{ id, platform }]。 */
  const listEmulators = (): { id: string, platform: string | undefined }[] => {
    const output = spawnSync('flutter', ['emulators'], {
      cwd: appDir,
      encoding: 'utf8',
      shell: IS_WIN,
    }).stdout ?? ''
    return output
      .split('\n')
      .filter(line => line.includes('•'))
      .map(line => line.split('•').map(col => col.trim()))
      .map(cols => ({
        id: cols[0],
        platform: cols[cols.length - 1]?.toLowerCase(),
      }))
      .filter(emu => emu.id && emu.id.toLowerCase() !== 'id')
  }

  /** 已在執行的 Android 模擬器對應的 AVD 名稱（用來從「可開機」清單去重）。 */
  const runningAndroidAvdNames = (): string[] => {
    const adb = findAdb()
    const names: string[] = []
    for (const device of listDevices().filter(isAndroid)) {
      const output = spawnSync(adb, ['-s', device.id, 'emu', 'avd', 'name'], { encoding: 'utf8' }).stdout ?? ''
      const name = output.split('\n')[0]?.trim()
      if (name) {
        names.push(name)
      }
    }
    return names
  }

  const bootableAndroidEmulators = (): TargetOption[] => {
    const running = new Set(runningAndroidAvdNames())
    return listEmulators()
      .filter(emu => emu.platform === 'android' && !running.has(emu.id))
      .map(emu => ({
        label: `${emu.id} [Android 模擬器·可開機]`,
        kind: 'android' as const,
        boot: {
          type: 'emu' as const,
          id: emu.id,
        },
      }))
  }

  /** 未開機的 iOS 模擬器（xcrun simctl）。 */
  const bootableIosSimulators = (): TargetOption[] => {
    const output = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8' }).stdout ?? ''
    let data: { devices?: Record<string, { name: string, udid: string, state: string, isAvailable?: boolean }[]> }
    try {
      data = JSON.parse(output)
    }
    catch {
      return []
    }
    const sims: TargetOption[] = []
    for (const [runtime, devices] of Object.entries(data.devices ?? {})) {
      if (!runtime.includes('iOS')) {
        continue
      }
      const version = (runtime.split('.').pop() ?? '').replace('iOS-', 'iOS ').replace(/-/g, '.')
      for (const device of devices) {
        if (device.state !== 'Booted' && device.isAvailable !== false) {
          sims.push({
            label: `${device.name} · ${version} [iOS 模擬器·可開機]`,
            kind: 'sim',
            boot: {
              type: 'sim',
              udid: device.udid,
            },
          })
        }
      }
    }
    return sims
  }

  // ---- 互動選單 ----
  const runningTargets = (scope: Scope): TargetOption[] => {
    return listDevices()
      .filter(device => device.id !== 'chrome' && device.targetPlatform !== 'web-javascript')
      .filter((device) => {
        if (scope === 'ios') {
          return isIos(device)
        }
        if (scope === 'android') {
          return isAndroid(device)
        }
        return true
      })
      .map((device) => {
        const kind = deviceKind(device)
        const tag = kind === 'desktop' ? '桌面' : device.emulator ? '模擬器' : '實機'
        return {
          label: `${device.name} (${device.id}) [${tag}·執行中]`,
          deviceId: device.id,
          kind,
          boot: null,
        }
      })
  }

  const buildOptions = (scope: Scope): TargetOption[] => {
    const options = runningTargets(scope)
    if (scope === 'all' || scope === 'ios') {
      options.push(...bootableIosSimulators())
    }
    if (scope === 'all' || scope === 'android') {
      options.push(...bootableAndroidEmulators())
    }
    return options
  }

  // 整個互動流程（env / flavor / 裝置）共用同一個 prompter：兩套 readline 會搶 stdin、管線餵答案時掉行。
  // 只在真的要問時才建立（`rl` 一建 stdin 就進入互動模式），用完即關。
  let prompter: Prompter | null = null
  const getPrompter = (): Prompter => {
    prompter ??= createPrompter({
      onClose: () => fail('輸入已結束，未啟動任何程序。'),
    })
    return prompter
  }
  const closePrompter = (): void => {
    prompter?.close()
    prompter = null
  }

  const promptChoice = (options: TargetOption[]): Promise<TargetOption> => chooseOne(getPrompter(), '請選擇目標裝置：', options)

  interface Preset {
    envPath: string | null
    flavor: string | null
  }

  /**
   * 互動模式（未指定 target）且旗標未給時，先問 env 檔與 flavor；有旗標就照旗標。
   * env 沒有可選檔案時退回預設值（與非互動相同，找不到再由 resolveEnvFile 中止）；
   * flavor 一個都沒建就不問。
   */
  const promptEnvAndFlavor = async (preset: Preset): Promise<{ envPath: string, flavor: string | null }> => {
    let envPath = preset.envPath
    if (envPath === null) {
      const envFiles = listEnvFiles(project)
      if (envFiles.length === 0) {
        envPath = config.defaultDevEnv
      }
      else {
        const defaultIndex = Math.max(0, envFiles.findIndex(env => env.path === config.defaultDevEnv))
        envPath = (await chooseOne(
          getPrompter(),
          '請選擇 env 檔：',
          envFiles.map(env => ({
            label: `${env.name.padEnd(12)}${env.path}`,
            path: env.path,
          })),
          defaultIndex,
        )).path
      }
    }
    let flavor = preset.flavor
    if (flavor === null) {
      const flavors = listFlavors(project)
      if (flavors.length > 0) {
        flavor = (await chooseOne<{ label: string, name: string | null }>(
          getPrompter(),
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
    return {
      envPath,
      flavor,
    }
  }

  const waitForDevice = async (predicate: (device: FlutterDevice) => boolean): Promise<FlutterDevice | null> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const device = listDevices().find(predicate)
      if (device) {
        return device
      }
      await sleep(4000)
    }
    return null
  }

  const ensureBooted = async (choice: TargetOption): Promise<string> => {
    const boot = choice.boot
    if (!boot) {
      return choice.deviceId as string
    }
    if (boot.type === 'sim') {
      console.log(`[${TAG}] 開機 iOS 模擬器…`)
      spawnSync('xcrun', ['simctl', 'boot', boot.udid as string], { stdio: 'inherit' })
      spawnSync('open', ['-a', 'Simulator'], { stdio: 'ignore' })
      const device = await waitForDevice(d => d.id === boot.udid)
      if (!device) {
        return fail('iOS 模擬器啟動逾時。')
      }
      return device.id
    }
    console.log(`[${TAG}] 啟動 Android 模擬器 ${boot.id}…`)
    spawnSync('flutter', ['emulators', '--launch', boot.id as string], {
      cwd: appDir,
      stdio: 'inherit',
      shell: IS_WIN,
    })
    const device = await waitForDevice(isAndroid)
    if (!device) {
      return fail('Android 模擬器啟動逾時。')
    }
    return device.id
  }

  const pickInteractive = async (scope: Scope): Promise<ResolvedTarget> => {
    const options = buildOptions(scope)
    if (options.length === 0) {
      fail(`找不到 ${scope} 目標裝置（可先啟動模擬器或連上實機）。`)
    }
    const choice = options.length === 1 ? options[0] : await promptChoice(options)
    const deviceId = await ensureBooted(choice)
    return {
      deviceId,
      kind: choice.kind,
    }
  }

  // ---- target → 裝置 ----
  const resolveTarget = async (target: string): Promise<ResolvedTarget> => {
    if (DESKTOP_TARGETS.has(target)) {
      return {
        deviceId: target,
        kind: 'desktop',
      }
    }
    if (target === 'ios-device') {
      const device = listDevices().find(d => isIos(d) && !d.emulator)
      if (!device) {
        return fail('找不到已連接的 iOS 實機（實機無法自動啟動，請插上並解鎖）。')
      }
      return {
        deviceId: device.id,
        kind: 'ios-device',
      }
    }
    if (target === 'pick' || target === 'all') {
      return pickInteractive('all')
    }
    if (target === 'ios') {
      return pickInteractive('ios')
    }
    if (target === 'android' || target === 'android-device') {
      return pickInteractive('android')
    }

    // 明確 device id（不啟動）
    const device = listDevices().find(d => d.id === target)
    if (!device) {
      return fail(`未知 target「${target}」，且非執行中的 device id。可用：省略(互動) / ios / android / macos / windows / linux / ios-device / <device id>。`)
    }
    return {
      deviceId: device.id,
      kind: deviceKind(device),
    }
  }

  interface Connectivity {
    devUrl: string
    devHost: string | null
    adb: string | null
  }

  // ---- 依種類決定連線（AQUTTER_DEV_URL / DEV_HOST / adb reverse）----
  const setupConnectivity = ({ deviceId, kind, port }: ResolvedTarget & { port: number }): Connectivity => {
    if (kind === 'android') {
      // adb reverse：裝置的 localhost:port → 開發機的 port（模擬器與 USB 實機皆適用）
      const adb = findAdb()
      spawnSync(adb, ['-s', deviceId, 'reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'inherit' })
      return {
        devUrl: `http://localhost:${port}`,
        devHost: null,
        adb,
      }
    }
    if (kind === 'ios-device') {
      // iOS 實機沒有 adb reverse，改連開發機區網 IP；HMR host 也需指向該 IP
      const ip = lanIp()
      if (!ip) {
        fail('無法偵測開發機區網 IP（iOS 實機 dev 需要）。請確認已連上網路。')
      }
      return {
        devUrl: `http://${ip}:${port}`,
        devHost: ip,
        adb: null,
      }
    }
    // desktop（macOS / Windows / Linux）/ iOS 模擬器：與 dev server 同機，直接走 localhost
    return {
      devUrl: `http://localhost:${port}`,
      devHost: null,
      adb: null,
    }
  }

  // ---- 主流程 ----
  const { positional, flags } = parseArgs(argv)
  const target = positional[0] ?? 'pick' // positional：target（macos/ios/android/<id>）
  // 未指定 target 即互動模式：env / flavor 未帶旗標時用選單問；否則環境一律用 --env=<env 檔路徑>
  // --x-env=<name> 展開為 env / flavor（dev 不簽章，故無 signing；明給的旗標優先）
  const preset = resolveXEnv(project, flags, {
    tag: TAG,
    withSigning: false,
  })
  const { envPath, flavor: selectedFlavor } = target === 'pick'
    ? await promptEnvAndFlavor(preset)
    : {
        envPath: preset.envPath ?? config.defaultDevEnv,
        flavor: preset.flavor, // Flutter flavor（對應 iOS scheme + Android productFlavor）
      }
  const port = resolvePort(project, flags) // dev server 埠，`--port=<n>` 可覆寫

  if (port === null) {
    return fail(`--port 需為 1-65535 的整數，收到「${flags.port}」。`)
  }

  if (positional.length > 1) {
    console.warn(`[${TAG}] 忽略多餘位置參數：${positional.slice(1).join(' ')}（環境請用 -e <環境名或 env 檔路徑>）`)
  }

  // --env / -e 的值可以是設定檔的環境名，或 env 檔路徑；環境名會帶入該環境設定的 flavor 與網頁指令（旗標優先）
  const resolvedEnvironment = resolveEnvironment(project, envPath)
  if (!resolvedEnvironment.ok) {
    return fail(resolvedEnvironment.error)
  }
  const environment = resolvedEnvironment.value
  const envFile = environment.envFile
  const flavor = selectedFlavor ?? environment.flavor

  const resolved = await resolveTarget(target)
  closePrompter()
  const { devUrl, devHost, adb } = setupConnectivity({
    ...resolved,
    port,
  })

  console.log(
    `[${TAG}] device=${resolved.deviceId} kind=${resolved.kind} `
    + `env=${envFile}${flavor ? ` flavor=${flavor}` : ''} `
    + `AQUTTER_DEV_URL=${devUrl}${devHost ? ` DEV_HOST=${devHost}` : ''}`,
  )

  const children: ChildProcess[] = []
  let shuttingDown = false

  /**
   * 終結子進程。Windows 上另需連同子孫一併終結。
   *
   * `run()` 在 win32 以 `shell: true` spawn（`pnpm` / `flutter` 為 .cmd/.bat，無 shell 會 ENOENT），
   * 因此 children 裡拿到的是 cmd.exe，長駐的 node / App 的 .exe 是**孫**進程。
   * Windows 又沒有 POSIX signal 語意，`kill('SIGTERM')` 只會終結那層殼、孫進程原地存活，
   * 於是留下抓著埠與檔案鎖的孤兒，讓下一次 dev 撞上 dev server 的鎖或 MSBuild 檔案鎖定。
   * taskkill 的 `/T` 涵蓋整棵樹、`/F` 強制；它是 .exe 而非批次檔，故不加 shell（比照 adb 呼叫）。
   * 用 spawnSync 是因為呼叫端隨後即 `process.exit()`，非同步版本會在終結完成前就讓行程結束。
   */
  const terminate = (child: ChildProcess): void => {
    if (!IS_WIN) {
      child.kill('SIGTERM')
      return
    }
    // spawn 失敗時沒有 pid，此時無樹可終結
    if (!child.pid) {
      return
    }
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }

  const shutdown = (code: number): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    if (adb) {
      spawnSync(adb, ['-s', resolved.deviceId, 'reverse', '--remove', `tcp:${port}`], { stdio: 'ignore' })
    }
    for (const child of children) {
      try {
        terminate(child)
      }
      catch {
        // 已結束者忽略
      }
    }
    process.exit(code)
  }

  const run = (command: string, args: string[], options: { cwd: string, env?: NodeJS.ProcessEnv }): ChildProcess => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: IS_WIN,
      ...options,
    })
    children.push(child)
    child.on('exit', code => shutdown(code ?? 0))
    return child
  }

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))

  // 網頁 dev server（單一 env 源；iOS 實機時以 DEV_HOST 綁 LAN + 設 HMR host）。
  // 指令細節（參數順序、env 如何帶入）由框架轉接器負責，見 web.ts；DEV_PORT / DEV_HOST 以 env 交棒，
  // 因為專案設定讀不到本指令的 CLI 參數——CSP 的 connect-src 與 HMR clientPort 都要組出同一個埠，
  // 漏掉會讓非預設埠的 HMR websocket 被 CSP 靜默擋掉。
  const web = createWebAdapter(project, environment.web)
  const devServer = web.dev({
    envFile,
    port,
    devHost: devHost ?? undefined,
  })
  run(devServer.command, devServer.args, {
    cwd: project.root,
    env: {
      ...process.env,
      ...devServer.env,
    },
  })

  // dev 走 dev server、不讀種子內容，但 pubspec 仍宣告該資源目錄；目錄缺席會讓 flutter 在資源打包階段失敗。
  ensureSeedDir(project)

  // Flutter run（同一 env 檔；AQUTTER_DEV_URL 以 CLI 覆蓋 file 值）
  const flutterArgs = [
    'run',
    '-d', resolved.deviceId,
    '--dart-define-from-file', join(project.root, envFile),
    '--dart-define', `AQUTTER_DEV_URL=${devUrl}`,
  ]
  if (flavor) {
    flutterArgs.push('--flavor', flavor)
  }
  // Android 專屬：HCPP（Hybrid Composition++）合成模式的開關。
  // aqutter_core（承襲 inappwebview fork 自 6.2.0-beta.3.5 起的行為），未指定 androidCompositionMode 時會自動選擇——
  // 能用 HCPP 就用 HCPP，否則退回 TLHC。而「能不能用」取決於引擎旗標有沒有開。
  //
  // 兩條啟動路徑各有各的開關，互補而非重複：
  //   - 一般啟動（安裝後從 launcher 開）：讀 AndroidManifest 的 io.flutter.embedding.android.EnableHcpp
  //     （embedding 的 FlutterEngineFlags 把它與 EnableImpeller 登記在同一份 meta-data 註冊表）。
  //   - `flutter run` 由工具啟動：讀本旗標。它是隱藏旗標（--help 看不到），會讓 flutter tool 以
  //     intent extra `--ez enable-hcpp-and-surface-control true` 啟動 app。不帶就沒有這個 extra，
  //     開發期永遠跑不到 HCPP。
  //
  // 限定 Android 是因為該旗標只在 Android 裝置的啟動指令上產生 extra，對 iOS 與桌面無意義。
  if (resolved.kind === 'android') {
    flutterArgs.push('--enable-hcpp')
  }
  run('flutter', flutterArgs, { cwd: appDir })
}
