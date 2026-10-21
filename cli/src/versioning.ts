// doctor / upgrade 共用的純函式（versioning）：解析與改寫「專案中與框架版本綁定」的檔案。
//   - <appDir>/pubspec.yaml ：environment.sdk / environment.flutter、殼依賴的 git ref
//   - <appDir>/.fvmrc       ：Flutter 版本（FVM 使用者自己放的選配檔；框架不要求、也不替專案建立）
//   - package.json          ：@aqutter/aqutter、@aqutter/aqutter-cli 的 github 依賴 ref
//   - <appDir>/pubspec.lock ：殼與 aqutter_core 實際鎖定的 commit
// 這裡只做字串進出，不碰檔案系統與網路，方便測試。改寫一律保留原有的換行與格式，只動需要動的那一行。

export interface ShellDependency {
  kind: 'git' | 'path'
  /** git 依賴的 ref；path 依賴為 null。 */
  ref: string | null
  /** git 依賴的 url；path 依賴為 null。 */
  url: string | null
  /** path 依賴的路徑；git 依賴為 null。 */
  path: string | null
}

export interface PubspecInfo {
  sdk: string | null
  flutter: string | null
  shell: ShellDependency | null
}

export interface LockGitPackage {
  url: string
  ref: string
  resolvedRef: string
}

export interface NpmSpec {
  name: string
  ref: string
}

export const SHELL_PACKAGE = 'aqutter'
/** 殼依賴會連帶拉進來、也要一起更新 lock 的套件。 */
export const LOCKED_PACKAGES = ['aqutter', 'aqutter_core'] as const
export const NPM_PACKAGES = ['@aqutter/aqutter', '@aqutter/aqutter-cli'] as const

const eolOf = (text: string): string => (text.includes('\r\n') ? '\r\n' : '\n')
const splitLines = (text: string): string[] => text.split(/\r?\n/)
const indentOf = (line: string): number => (/^ */.exec(line) as RegExpExecArray)[0].length

/** `lines[start]` 為區塊標題行；回傳其內容行的範圍 [from, to)（縮排比標題深的連續行，含空行）。 */
const bodyRange = (lines: string[], start: number): [number, number] => {
  const indent = indentOf(lines[start])
  let end = start + 1
  while (end < lines.length && (lines[end].trim() === '' || indentOf(lines[end]) > indent)) {
    end += 1
  }
  return [start + 1, end]
}

const findLine = (lines: string[], pattern: RegExp, from = 0, to = lines.length): number => {
  for (let i = from; i < to; i += 1) {
    if (pattern.test(lines[i])) {
      return i
    }
  }
  return -1
}

/** 去掉行尾註解與引號：`'>=3.47.4'  # note` → `>=3.47.4`。 */
const scalar = (raw: string): string => {
  const noComment = raw.replace(/\s+#.*$/, '').trim()
  return noComment.replace(/^(['"])(.*)\1$/, '$2')
}

const valueOf = (line: string): string => scalar(line.slice(line.indexOf(':') + 1))

export const parsePubspec = (text: string): PubspecInfo => {
  const lines = splitLines(text)
  const info: PubspecInfo = { sdk: null, flutter: null, shell: null }

  const env = findLine(lines, /^environment:\s*$/)
  if (env !== -1) {
    const [from, to] = bodyRange(lines, env)
    const sdk = findLine(lines, /^ {2}sdk:/, from, to)
    const flutter = findLine(lines, /^ {2}flutter:/, from, to)
    info.sdk = sdk === -1 ? null : valueOf(lines[sdk])
    info.flutter = flutter === -1 ? null : valueOf(lines[flutter])
  }

  const deps = findLine(lines, /^dependencies:\s*$/)
  if (deps !== -1) {
    const [from, to] = bodyRange(lines, deps)
    const shell = findLine(lines, new RegExp(`^ {2}${SHELL_PACKAGE}:\\s*$`), from, to)
    if (shell !== -1) {
      const [sFrom, sTo] = bodyRange(lines, shell)
      const path = findLine(lines, /^ {4}path:/, sFrom, sTo)
      const git = findLine(lines, /^ {4}git:\s*$/, sFrom, sTo)
      if (path !== -1) {
        info.shell = { kind: 'path', ref: null, url: null, path: valueOf(lines[path]) }
      }
      else if (git !== -1) {
        const [gFrom, gTo] = bodyRange(lines, git)
        const ref = findLine(lines, /^ {6}ref:/, gFrom, gTo)
        const url = findLine(lines, /^ {6}url:/, gFrom, gTo)
        info.shell = {
          kind: 'git',
          ref: ref === -1 ? null : valueOf(lines[ref]),
          url: url === -1 ? null : valueOf(lines[url]),
          path: null,
        }
      }
    }
  }
  return info
}

export interface PubspecTarget {
  sdk: string
  flutter: string
  /** null 表示不動殼的 ref（例如 path 依賴）。 */
  shellRef: string | null
}

/** 把 pubspec 改到目標版本；回傳新內容與實際改了哪些項目（沒變就不會列出）。 */
export const rewritePubspec = (text: string, target: PubspecTarget): { text: string, changes: string[] } => {
  const eol = eolOf(text)
  const lines = splitLines(text)
  const changes: string[] = []
  const quoted = (value: string): string => `'${value}'`

  const setEnv = (key: 'sdk' | 'flutter', value: string): void => {
    const env = findLine(lines, /^environment:\s*$/)
    if (env === -1) {
      return
    }
    const [from, to] = bodyRange(lines, env)
    const at = findLine(lines, new RegExp(`^ {2}${key}:`), from, to)
    const wanted = `  ${key}: ${quoted(value)}`
    if (at === -1) {
      // 沒有該鍵：插在區塊最後一個非空行之後
      let last = to - 1
      while (last > from && lines[last].trim() === '') {
        last -= 1
      }
      lines.splice(last + 1, 0, wanted)
      changes.push(`environment.${key}: （新增）→ ${value}`)
      return
    }
    const current = valueOf(lines[at])
    if (current !== value) {
      lines[at] = wanted
      changes.push(`environment.${key}: ${current} → ${value}`)
    }
  }
  setEnv('sdk', target.sdk)
  setEnv('flutter', target.flutter)

  if (target.shellRef !== null) {
    const deps = findLine(lines, /^dependencies:\s*$/)
    if (deps !== -1) {
      const [from, to] = bodyRange(lines, deps)
      const shell = findLine(lines, new RegExp(`^ {2}${SHELL_PACKAGE}:\\s*$`), from, to)
      if (shell !== -1) {
        const [sFrom, sTo] = bodyRange(lines, shell)
        const git = findLine(lines, /^ {4}git:\s*$/, sFrom, sTo)
        if (git !== -1) {
          const [gFrom, gTo] = bodyRange(lines, git)
          const ref = findLine(lines, /^ {6}ref:/, gFrom, gTo)
          if (ref !== -1) {
            const current = valueOf(lines[ref])
            if (current !== target.shellRef) {
              lines[ref] = `      ref: ${target.shellRef}`
              changes.push(`${SHELL_PACKAGE} ref: ${current} → ${target.shellRef}`)
            }
          }
        }
      }
    }
  }
  return { text: lines.join(eol), changes }
}

/** 讀 `.fvmrc` 的 flutter 版本；不是合法 JSON 或沒有該欄位回 null。 */
export const parseFvmrc = (text: string): string | null => {
  try {
    const value = (JSON.parse(text) as { flutter?: unknown }).flutter
    return typeof value === 'string' && value !== '' ? value : null
  }
  catch {
    return null
  }
}

/** 寫入 `.fvmrc` 的 flutter 版本，保留檔內其他欄位；原內容不是合法 JSON 時回 null（由呼叫端中止，不覆寫）。 */
export const rewriteFvmrc = (text: string | null, version: string): { text: string, changed: boolean } | null => {
  let data: Record<string, unknown> = {}
  if (text !== null && text.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null
      }
      data = parsed as Record<string, unknown>
    }
    catch {
      return null
    }
  }
  if (data.flutter === version) {
    return { text: text as string, changed: false }
  }
  return { text: `${JSON.stringify({ ...data, flutter: version }, null, 2)}\n`, changed: true }
}

const NPM_SPEC = /^github:Aqutter\/aqutter#([^&]+)&path:.*$/

/** package.json 裡 Aqutter 的 github 依賴（dependencies 與 devDependencies）。 */
export const readNpmSpecs = (text: string): NpmSpec[] => {
  let json: { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
  try {
    json = JSON.parse(text)
  }
  catch {
    return []
  }
  const specs: NpmSpec[] = []
  for (const group of [json.dependencies, json.devDependencies]) {
    for (const name of NPM_PACKAGES) {
      const match = NPM_SPEC.exec(group?.[name] ?? '')
      if (match) {
        specs.push({ name, ref: match[1] })
      }
    }
  }
  return specs
}

/** 把 package.json 內 Aqutter 的 github 依賴 ref 改為 `ref`；以字串替換保留原有格式。 */
export const rewritePackageJson = (text: string, ref: string): { text: string, changes: string[] } => {
  const changes: string[] = []
  const pattern = /("@aqutter\/aqutter(?:-cli)?"\s*:\s*"github:Aqutter\/aqutter#)([^&"]+)(&path:[^"]*")/g
  const next = text.replace(pattern, (whole, head: string, current: string, tail: string) => {
    if (current === ref) {
      return whole
    }
    const name = /"(@aqutter\/[^"]+)"/.exec(head)?.[1] ?? ''
    changes.push(`${name}: ${current} → ${ref}`)
    return `${head}${ref}${tail}`
  })
  return { text: next, changes }
}

/** 讀 pubspec.lock 中 git 來源套件的 url / ref / resolved-ref。 */
export const parseLock = (text: string): Record<string, LockGitPackage> => {
  const lines = splitLines(text)
  const result: Record<string, LockGitPackage> = {}
  const packages = findLine(lines, /^packages:\s*$/)
  if (packages === -1) {
    return result
  }
  const [from, to] = bodyRange(lines, packages)
  for (let i = from; i < to; i += 1) {
    const header = /^ {2}([A-Za-z0-9_]+):\s*$/.exec(lines[i])
    if (!header) {
      continue
    }
    const [bFrom, bTo] = bodyRange(lines, i)
    const read = (key: string): string | null => {
      const at = findLine(lines, new RegExp(`^ {6}${key}:`), bFrom, bTo)
      return at === -1 ? null : valueOf(lines[at])
    }
    const resolvedRef = read('resolved-ref')
    const url = read('url')
    const ref = read('ref')
    if (resolvedRef && url && ref) {
      result[header[1]] = { url, ref, resolvedRef }
    }
  }
  return result
}

/** 約束 `>=a.b.c [<d.e.f]` 的下限（框架以它作為基準版本）；沒有 `>=` 下限回 null。 */
export const lowerBound = (constraint: string): string | null => {
  const match = />=(\d+\.\d+\.\d+)/.exec(constraint)
  return match ? match[1] : null
}

/** 版本約束 `>=a.b.c [<d.e.f]` 是否包含 `version`；無法判讀的約束回 null。 */
export const satisfies = (version: string, constraint: string): boolean | null => {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value)
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
  }
  const compare = (a: number[], b: number[]): number => {
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) {
        return a[i] - b[i]
      }
    }
    return 0
  }
  const v = parse(version)
  if (!v) {
    return null
  }
  const parts = constraint.trim().split(/\s+/)
  let ok = true
  for (const part of parts) {
    const match = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/.exec(part)
    if (!match) {
      return null
    }
    const bound = parse(match[2]) as number[]
    const cmp = compare(v, bound)
    const op = match[1] ?? '='
    const pass = op === '>=' ? cmp >= 0 : op === '<=' ? cmp <= 0 : op === '>' ? cmp > 0 : op === '<' ? cmp < 0 : cmp === 0
    ok = ok && pass
  }
  return ok
}
