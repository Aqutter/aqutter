// 範本展開：把 template/ 下的檔案複製出去，並代換 `{{variable}}` 佔位符（內容與路徑皆適用）。
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type TemplateVariables = Record<string, string>

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.jar', '.so', '.dll', '.a', '.ttf', '.otf',
  '.woff', '.woff2', '.keystore', '.jks', '.zip', '.gz', '.pdf',
])

const isBinary = (path: string, content: Buffer): boolean => {
  const dot = path.lastIndexOf('.')
  if (dot !== -1 && BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase())) {
    return true
  }
  return content.includes(0)
}

/**
 * 代換 `{{name}}`；只處理 `variables` 內有的名稱，其餘（例如 Windows runner 的
 * `{{NO_DEPENDENCIES}}` 標記）原樣保留。
 */
export const substitute = (text: string, variables: TemplateVariables): string => {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => variables[key] ?? whole)
}

/** 找 CLI 自帶的範本根目錄（含 `app/` 與 `plugin/`）：由本檔所在位置往上找。 */
export const findTemplateRoot = (): string => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, 'template')
    if (existsSync(join(candidate, 'app'))) {
      return candidate
    }
    dir = resolve(dir, '..')
  }
  throw new Error('找不到 Aqutter 範本目錄（template/）。CLI 安裝是否完整？')
}

/**
 * 遞迴展開 `source` 到 `target`。已存在的檔案預設不覆寫（回傳於 `skipped`），
 * 讓重跑 init 不會洗掉使用者的修改。
 */
export const renderTree = (
  source: string,
  target: string,
  variables: TemplateVariables,
  { overwrite = false }: { overwrite?: boolean } = {},
): { written: string[], skipped: string[] } => {
  const written: string[] = []
  const skipped: string[] = []
  const walk = (from: string, to: string): void => {
    for (const name of readdirSync(from)) {
      const src = join(from, name)
      const dst = join(to, substitute(name, variables))
      if (statSync(src).isDirectory()) {
        walk(src, dst)
        continue
      }
      if (existsSync(dst) && !overwrite) {
        skipped.push(dst)
        continue
      }
      mkdirSync(dirname(dst), { recursive: true })
      const content = readFileSync(src)
      if (isBinary(src, content)) {
        copyFileSync(src, dst)
      }
      else {
        writeFileSync(dst, substitute(content.toString('utf8'), variables))
      }
      written.push(dst)
    }
  }
  walk(source, target)
  return { written, skipped }
}
