// dev / build / seed 共用：參數解析、env 檔解析、產物命名、逐步執行器、互動問答器。
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { connect } from 'node:net'
import { basename, join } from 'node:path'
import readline from 'node:readline'
import type { Project } from './config.ts'

// TCP 埠的合法範圍
const MIN_PORT = 1
const MAX_PORT = 65535

// Windows 上外部 CLI 多為 .cmd/.bat（pnpm/flutter），Node ≥18.20 需 shell 才能 spawn；
// macOS/Linux 為無副檔名執行檔，維持 shell=false（原行為，零迴歸）。
export const IS_WIN = process.platform === 'win32'

export interface Flags {
  [key: string]: string
}

export interface ParsedArgs {
  positional: string[]
  flags: Flags
}

/** 短旗標對應的長旗標名稱。目前只有 `-e`（= `--env`）。 */
export const SHORT_FLAGS: Readonly<Record<string, string>> = { e: 'env' }

/**
 * 解析參數為 { positional, flags }：
 * - `--key=value` 收進 flags；
 * - 短旗標 `-e=value` 或 `-e value`（見 [SHORT_FLAGS]）等同 `--env=value`；
 * - 其餘為位置參數（`--key value` 的空白寫法仍視為位置參數，值須以 `=` 綁定）。
 *
 * 短旗標的值只吃「下一個不以 `-` 開頭」的參數，所以 `-e` 後面接旗標或結尾時值為空字串，
 * 由呼叫端回報「需要值」，不會把後面的旗標或平台名吞掉。
 */
export const parseArgs = (argv: string[]): ParsedArgs => {
  const positional: string[] = []
  const flags: Flags = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const long = /^--([^=]+)=(.*)$/.exec(arg)
    if (long) {
      flags[long[1]] = long[2]
      continue
    }
    const short = /^-([A-Za-z])(?:=(.*))?$/.exec(arg)
    if (short && SHORT_FLAGS[short[1]] !== undefined) {
      const name = SHORT_FLAGS[short[1]]
      if (short[2] !== undefined) {
        flags[name] = short[2]
      }
      else {
        const next = argv[index + 1]
        if (next !== undefined && !next.startsWith('-')) {
          flags[name] = next
          index += 1
        }
        else {
          flags[name] = ''
        }
      }
      continue
    }
    positional.push(arg)
  }
  return {
    positional,
    flags,
  }
}

/**
 * 解析 dev server 埠：`--port=<n>` 優先，未指定回設定的預設埠，值非法回 null 交由呼叫端中止。
 * 刻意不在非法時靜默退回預設——AQUTTER_DEV_URL 與 dev server 會就此指向不同埠，
 * 那正是本參數要消除的靜默分歧（比照 resolveEnvFile 不退回預設 env 檔的理由）。
 */
export const resolvePort = (project: Project, flags: Flags): number | null => {
  if (flags.port === undefined) {
    return project.config.defaultPort
  }
  const port = Number(flags.port)
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    return null
  }
  return port
}

// 埠探測的連線逾時（本機回送，通常即時成功或即時拒絕）
const PORT_PROBE_TIMEOUT_MS = 500

/**
 * 該埠是否已有程式在聆聽。
 *
 * 同時探 IPv4 與 IPv6 回送位址：`localhost` 在不同系統解析成 `127.0.0.1` 或 `::1`，
 * dev server 與別的程式可能分別綁在兩個位址族上，兩邊都不衝突、啟動不報錯，
 * 瀏覽器與殼卻連到另一個專案（用「連得上」判斷，而非「綁得上」）。
 */
export const isPortInUse = async (port: number): Promise<boolean> => {
  const probe = (host: string): Promise<boolean> => new Promise((resolve) => {
    const socket = connect({
      port,
      host,
    })
    const done = (inUse: boolean): void => {
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(PORT_PROBE_TIMEOUT_MS, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
  const results = await Promise.all([probe('127.0.0.1'), probe('::1')])
  return results.some(Boolean)
}

/**
 * 確保種子目錄存在（空目錄即可）。
 * App 的 pubspec 以目錄形式宣告 `assets/seed/`，該目錄缺席時 flutter 會在資源打包階段直接失敗；
 * 全新 clone 因目錄未納入版控而不存在，故 dev 與打包前都需先補上。
 */
export const ensureSeedDir = (project: Project): void => {
  mkdirSync(project.seedDir, { recursive: true })
}

/** 某個步驟（子行程）失敗；由 createStep 丟出，呼叫端決定是中止整個行程還是續跑其他工作。 */
export class StepFailure extends Error {
  label: string
  status: number | null
  constructor(tag: string, label: string, status: number | null) {
    super(`[${tag}] 步驟失敗：${label}（exit ${status ?? 'signal'}）。`)
    this.name = 'StepFailure'
    this.label = label
    this.status = status
  }
}

export type StepRunner = (label: string, command: string, args: string[], cwd: string, secrets?: string[], env?: NodeJS.ProcessEnv) => void

/**
 * 產生逐步執行器：印出命令、同步執行（stdio 直通），任一步失敗即印錯並丟 StepFailure——
 * 單一工作的指令在頂層 catch 後 exit 1，多平台迴圈則逐平台 catch 以續跑其餘。
 * `tag` 為各指令的 log 前綴（`flutter:build` / `flutter:sign`）。
 * `secrets` 內的值在印出的命令列以 `***` 取代（命令本身仍原樣傳給子行程）——pfx 密碼之類
 * 的參數不該留在 CI log 裡。
 */
export const createStep = (tag: string): StepRunner => (label, command, args, cwd, secrets = [], env) => {
  const shown = args.map(arg => (secrets.includes(arg) ? '***' : arg))
  console.log(`\n[${tag}] ${label}: ${command} ${shown.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: IS_WIN,
    env: env ?? process.env,
  })
  if (result.status !== 0) {
    const failure = new StepFailure(tag, label, result.status)
    console.error(failure.message)
    throw failure
  }
}

/**
 * 解析 `--env=<path>`：值即 env 檔路徑（相對專案根）；存在回原值，不存在回 null 交由呼叫端中止。
 *
 * 刻意**不做任何退回**——不補 `<envDir>/.env.<值>`、不退 `.env`、更不退預設 dev env。
 * 打錯路徑時靜默跑到別的環境是最壞的一類錯誤：檔案時間戳會更新、種子版本會遞增，
 * 只有打開產物才看得出打錯環境（比照 resolvePort 非法值不退回預設的理由）。
 */
export const resolveEnvFile = (project: Project, envPath: string): string | null => {
  return existsSync(join(project.root, envPath)) ? envPath : null
}

/**
 * 產生 env 檔缺席時的錯誤訊息。
 * 在 env 目錄下恰好有對應檔案時附上正確寫法——**只提示，不自動改用**，
 * 自動改用等於把剛移除的退回行為換個地方長回來。
 */
export const describeMissingEnv = (project: Project, envPath: string): string => {
  const dir = project.config.envDir
  const relocated = [`${dir}/.env.${envPath}`, `${dir}/${envPath}`]
    .find(candidate => existsSync(join(project.root, candidate)))
  const hint = relocated
    ? `（偵測到 \`${relocated}\` 存在——\`--env=\` 吃的是相對專案根的路徑，請改寫為 \`--env=${relocated}\`）`
    : `（\`--env=\` 吃的是相對專案根的路徑，例如 \`--env=${dir}/.env.uat\`）`
  return `找不到 env 檔 \`${envPath}\`${hint}。請由 ${dir}/.env.example 複製一份。`
}

/**
 * 由 env 檔路徑推導環境名：取 basename 去掉開頭的 `.env.`（`.env.uat` → `uat`、
 * `.env/.env.prod` → `prod`）。檔名恰為 `.env` 時沒有可用的名稱，回 null 交由呼叫端中止——
 * 不猜 `default` 之類的值，產物檔名寫錯環境與打錯環境同樣是無聲錯誤。
 */
export const envNameOf = (envFile: string): string | null => {
  const name = basename(envFile).replace(/^\.env\.?/, '')
  return name === '' ? null : name
}

/**
 * 讀 App 的 `pubspec.yaml` 的 `version:` 原字串（含 build number，如 `1.0.0+1`）。
 * 找不到回 null 交由呼叫端中止。
 */
export const readAppVersion = (project: Project): string | null => {
  const pubspec = readFileSync(join(project.appDir, 'pubspec.yaml'), 'utf8')
  const match = /^version:\s*(\S+)/m.exec(pubspec)
  return match ? match[1] : null
}

// 走訪結果的條目型別：一般檔案，或 symlink（不解析目標）。
export const ENTRY_KIND = Object.freeze({
  file: 'file',
  symlink: 'symlink',
} as const)

export interface WalkEntry {
  path: string
  kind: (typeof ENTRY_KIND)[keyof typeof ENTRY_KIND]
  mode: number
}

/**
 * 遞迴走訪目錄。`followSymlinks` 決定 symlink 的處理：
 *   - true ：`statSync` 語意——指向目錄的連結整棵走進去、指向檔案的連結當一般檔案，
 *            回傳的條目全是 `file`。適合只要「內容」的用途（種子網頁包）。
 *   - false：`lstatSync` 語意——連結本身即一個 `symlink` 條目，不遞迴、不讀目標。
 *            適合要原樣還原目錄的用途（macOS `.app` 的 framework 全靠 `Versions/Current`
 *            這類連結組成，展開成實體複本會讓 bundle 結構失效、codesign 也驗不過）。
 * 每個條目帶 `mode`（lstat / stat 的原始 mode），供需要保留權限位的呼叫端使用。
 */
const walk = (dir: string, { followSymlinks }: { followSymlinks: boolean }): WalkEntry[] => {
  const entries: WalkEntry[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stats = followSymlinks ? statSync(full) : lstatSync(full)
    if (stats.isDirectory()) {
      entries.push(...walk(full, { followSymlinks }))
      continue
    }
    entries.push({
      path: full,
      kind: stats.isSymbolicLink() ? ENTRY_KIND.symlink : ENTRY_KIND.file,
      mode: stats.mode,
    })
  }
  return entries
}

/** 遞迴列出目錄下所有檔案的絕對路徑（跟隨 symlink；只要內容、不保留連結與權限）。 */
export const collectFiles = (dir: string): string[] => {
  return walk(dir, { followSymlinks: true }).map(entry => entry.path)
}

/**
 * 遞迴列出目錄下所有條目（不跟隨 symlink），每項為 `{ path, kind, mode }`。
 * 供需要把目錄「原樣」打包的呼叫端使用：symlink 保留為連結、檔案保留權限位。
 */
export const collectEntries = (dir: string): WalkEntry[] => {
  return walk(dir, { followSymlinks: false })
}

const MASK_CHAR = '*'
// 終端控制序列（ESC[ 開頭的游標移動 / 清行）與換行：遮罩期間也要原樣放行，否則游標會亂跳
const PASSTHROUGH_PREFIXES = ['\u001B[', '\r', '\n']
const isTerminalControl = (text: string): boolean => PASSTHROUGH_PREFIXES.some(prefix => text.startsWith(prefix))

export interface Prompter {
  ask: (label: string, options?: { secret?: boolean }) => Promise<string>
  askWithDefault: (label: string, defaultValue: string) => Promise<string>
  askRequired: (label: string) => Promise<string>
  askSecret: (label: string) => Promise<string>
  askYesNo: (label: string) => Promise<boolean>
  close: () => void
}

// readline 的 `_writeToOutput` 是未公開成員；遮罩輸入需要攔它
interface RawReadline extends readline.Interface {
  _writeToOutput: (text: string) => void
}

/**
 * 建立互動式問答器（gen-jks / flavor add 共用）。
 * 整個問答流程共用同一個 readline，並自行排隊 `line` 事件：管線餵答案時 readline 會一口氣把
 * 所有行都吐出來，用 rl.question 只接得到第一行，其餘會丟失。
 * `onClose`：輸入在回答完之前就結束（管線提前 EOF、Ctrl+D）時呼叫，不能讓 await 懸著。
 */
export const createPrompter = ({ onClose }: { onClose: () => void }): Prompter => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  }) as RawReadline
  const bufferedLines: string[] = []
  let resolvePendingLine: ((line: string) => void) | null = null
  rl.on('line', (line) => {
    if (resolvePendingLine === null) {
      bufferedLines.push(line)
      return
    }
    const resolve = resolvePendingLine
    resolvePendingLine = null
    resolve(line)
  })
  rl.on('close', () => {
    if (resolvePendingLine !== null) {
      onClose()
    }
  })
  const readLine = (): Promise<string> => {
    const buffered = bufferedLines.shift()
    if (buffered !== undefined) {
      return Promise.resolve(buffered)
    }
    return new Promise((resolve) => {
      resolvePendingLine = resolve
    })
  }

  // 遮罩狀態：為 true 時把 readline 回顯到終端的使用者輸入改印 `*`。
  let masked = false
  // readline 所有回顯（輸入字元、退格後整行重畫）都經過 _writeToOutput，
  // 攔它是 Node 不必自寫 raw mode 就能遮罩、且仍保有退格編輯的做法。
  const writeToOutput = rl._writeToOutput.bind(rl)
  rl._writeToOutput = (text: string) => {
    if (!masked || isTerminalControl(text)) {
      writeToOutput(text)
      return
    }
    // 退格後 readline 會以「提示 + 整行輸入」重畫，只遮輸入那一段
    const prompt = rl.getPrompt()
    const visible = text.startsWith(prompt) ? prompt : ''
    writeToOutput(visible + MASK_CHAR.repeat(text.length - visible.length))
  }

  /** 印提示並讀一行；`secret` 為 true 時提示仍明文、其後的輸入回顯改為 `*`。 */
  const ask = async (label: string, { secret = false }: { secret?: boolean } = {}): Promise<string> => {
    rl.setPrompt(label)
    rl.prompt()
    masked = secret
    const answer = await readLine()
    masked = false
    return secret ? answer : answer.trim()
  }

  /** 有預設值的問題：空白即採預設。 */
  const askWithDefault = async (label: string, defaultValue: string): Promise<string> => {
    const answer = await ask(`${label} [${defaultValue}]：`)
    return answer === '' ? defaultValue : answer
  }

  /** 必填問題：空白就重問，不給預設。 */
  const askRequired = async (label: string): Promise<string> => {
    for (;;) {
      const answer = await ask(`${label}（必填）：`)
      if (answer !== '') {
        return answer
      }
      console.log('  此欄位不可空白，請重新輸入。')
    }
  }

  const askSecret = (label: string): Promise<string> => ask(label, { secret: true })

  /** 是非題：只接受 y / n（大小寫不拘），其餘重問。 */
  const askYesNo = async (label: string): Promise<boolean> => {
    for (;;) {
      const answer = (await ask(`${label} (y/N)：`)).toLowerCase()
      if (answer === 'y' || answer === 'yes') {
        return true
      }
      if (answer === '' || answer === 'n' || answer === 'no') {
        return false
      }
    }
  }

  return {
    ask,
    askWithDefault,
    askRequired,
    askSecret,
    askYesNo,
    close: () => rl.close(),
  }
}
