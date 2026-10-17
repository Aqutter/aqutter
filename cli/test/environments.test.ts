import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConfigError, createProject, effectiveWeb, parseConfig } from '../src/config.ts'
import type { Project } from '../src/config.ts'
import { addEnvironment, listEnvironments, removeEnvironment } from '../src/commands/env.ts'
import { resolveEnvironment } from '../src/environments.ts'
import { parseArgs } from '../src/shared.ts'
import { createWebAdapter } from '../src/web.ts'

let root: string

const makeProject = (raw: Record<string, unknown> = {}, files: Record<string, string> = {}): Project => {
  writeFileSync(join(root, 'aqutter.config.json'), JSON.stringify(raw))
  mkdirSync(join(root, '.env'), { recursive: true })
  for (const [path, content] of Object.entries({ '.env/.env.example': '# example\nKEY=example\n', '.env/.env.dev': 'KEY=dev\n', ...files })) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return createProject(root, parseConfig(raw))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aqutter-env-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseArgs short flag -e', () => {
  it('accepts -e value and -e=value as --env', () => {
    expect(parseArgs(['-e', 'uat', 'apk']).flags).toEqual({ env: 'uat' })
    expect(parseArgs(['-e', 'uat', 'apk']).positional).toEqual(['apk'])
    expect(parseArgs(['-e=uat', 'apk']).flags).toEqual({ env: 'uat' })
    expect(parseArgs(['apk', '--env=.env/.env.uat']).flags).toEqual({ env: '.env/.env.uat' })
  })

  it('does not swallow the next flag or the platform when -e has no value', () => {
    expect(parseArgs(['-e', '--flavor=uat']).flags).toEqual({ env: '', flavor: 'uat' })
    expect(parseArgs(['-e']).flags).toEqual({ env: '' })
  })

  it('leaves other short options alone', () => {
    expect(parseArgs(['-h', '-x']).positional).toEqual(['-h', '-x'])
  })
})

describe('environments in the config', () => {
  it('parses environments and rejects bad names or shapes', () => {
    expect(parseConfig({ environments: { uat: { flavor: 'uat' } } }).environments.uat.flavor).toBe('uat')
    expect(() => parseConfig({ environments: { 'Bad Name': {} } })).toThrow(ConfigError)
    expect(() => parseConfig({ environments: { uat: 'x' } })).toThrow(/必須是物件/)
    expect(() => parseConfig({ environments: { uat: { flavor: '' } } })).toThrow(/flavor 必須是非空字串/)
    expect(() => parseConfig({ environments: [] })).toThrow(/必須是物件/)
    expect(() => parseConfig({ environments: { uat: { web: { devCommand: '  ' } } } })).toThrow(/devCommand 必須是非空字串/)
  })

  it('requires dev, build and output when commands are given without a framework', () => {
    expect(() => parseConfig({ web: { devCommand: 'x dev' } })).toThrow(/沒有寫 framework/)
    expect(() => parseConfig({ web: { devCommand: 'x dev', buildCommand: 'x build' } })).toThrow(/outputDir/)
    expect(() => parseConfig({ web: { devCommand: 'x dev', buildCommand: 'x build', outputDir: 'build' } })).not.toThrow()
    // 寫了 framework：只覆寫其中一個指令是合法的，其餘取框架預設
    expect(() => parseConfig({ web: { framework: 'nuxt', devCommand: 'x dev' } })).not.toThrow()
  })

  it('keeps the legacy custom form working', () => {
    expect(() => parseConfig({ web: { framework: 'custom', outputDir: 'o', custom: { dev: 'd', generate: 'g' } } })).not.toThrow()
    expect(() => parseConfig({ web: { framework: 'custom', outputDir: 'o' } })).toThrow(/custom/)
  })

  it('merges an environment web override over the top-level web, field by field', () => {
    const config = parseConfig({ web: { framework: 'nuxt', buildCommand: 'a' }, environments: { uat: { web: { buildCommand: 'b' } } } })
    expect(effectiveWeb(config, 'uat')).toMatchObject({ framework: 'nuxt', buildCommand: 'b' })
    expect(effectiveWeb(config, null).buildCommand).toBe('a')
  })
})

describe('resolveEnvironment', () => {
  it('resolves a configured name to its env file, flavor, signing and web overrides', () => {
    const project = makeProject(
      { environments: { uat: { flavor: 'uat', signing: 'signing/signing.uat.json', web: { buildCommand: 'x' } } } },
      { '.env/.env.uat': 'KEY=uat\n' },
    )
    const result = resolveEnvironment(project, 'uat')
    expect(result.ok && result.value).toMatchObject({
      name: 'uat', envFile: '.env/.env.uat', flavor: 'uat', signing: 'signing/signing.uat.json', source: 'config',
    })
    expect(result.ok && result.value.web.buildCommand).toBe('x')
  })

  it('uses an explicit envFile from the config', () => {
    const project = makeProject({ environments: { uat: { envFile: 'config/uat.env' } } }, { 'config/uat.env': 'K=1\n' })
    const result = resolveEnvironment(project, 'uat')
    expect(result.ok && result.value.envFile).toBe('config/uat.env')
  })

  it('treats a path as before, and maps it back to a configured environment when it is that environment\'s env file', () => {
    const project = makeProject({ environments: { dev: { flavor: 'dev' } } })
    const byPath = resolveEnvironment(project, '.env/.env.dev')
    expect(byPath.ok && byPath.value).toMatchObject({ name: 'dev', flavor: 'dev', source: 'config' })
    const plain = resolveEnvironment(makeProject({}, { '.env/.env.qa': 'K=1\n' }), '.env/.env.qa')
    expect(plain.ok && plain.value).toMatchObject({ name: 'qa', flavor: null, signing: null, source: 'path' })
  })

  it('fails without falling back, and lists the configured environments', () => {
    const project = makeProject({ environments: { uat: {} } }, { '.env/.env.uat': 'K=1\n' })
    const missing = resolveEnvironment(project, 'prod')
    expect(!missing.ok && missing.error).toMatch(/prod/)
    expect(!missing.ok && missing.error).toMatch(/已設定的環境：uat/)
    expect(!resolveEnvironment(project, '').ok).toBe(true)
  })

  it('hints when the conventional env file exists but the name is not registered (no silent fallback)', () => {
    const project = makeProject({}, { '.env/.env.uat': 'K=1\n' })
    const result = resolveEnvironment(project, 'uat')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/aqutter env add uat/)
  })

  it('reports a configured environment whose env file is missing', () => {
    const project = makeProject({ environments: { prod: {} } })
    const result = resolveEnvironment(project, 'prod')
    expect(!result.ok && result.error).toMatch(/環境「prod」的 env 檔/)
  })
})

describe('web adapter overrides', () => {
  it('overrides only the dev command and keeps the framework build', () => {
    const project = makeProject({ web: { framework: 'vite', devCommand: 'my-dev --port {port} --env {envFile}' } })
    const adapter = createWebAdapter(project)
    const dev = adapter.dev({ envFile: '.env/.env.dev', port: 4000 })
    expect(dev.args.join(' ')).toContain('my-dev --port 4000 --env .env/.env.dev')
    expect(dev.env).toMatchObject({ KEY: 'dev', DEV_PORT: '4000' }) // env 檔的鍵注入子行程環境
    const steps = adapter.generate({ envFile: '.env/.env.dev' })
    expect(steps[0].args.join(' ')).toContain('vite') // 打包仍是框架預設
    expect(adapter.outputDir).toBe('dist')
  })

  it('overrides the build command, with an optional prepare step', () => {
    const project = makeProject({ web: { framework: 'nuxt', buildCommand: 'pnpm nuxt generate --dotenv={envFile}', prepareCommand: 'pnpm nuxt prepare' } })
    const steps = createWebAdapter(project).generate({ envFile: '.env/.env.dev' })
    expect(steps.map(step => step.label)).toEqual(['prepare', 'build'])
    expect(steps[1].args.join(' ')).toContain('--dotenv=.env/.env.dev')
  })

  it('applies an environment override on top of the top-level web', () => {
    const project = makeProject(
      { web: { framework: 'nuxt' }, environments: { uat: { web: { buildCommand: 'pnpm generate:uat', outputDir: 'dist-uat' } } } },
      { '.env/.env.uat': 'K=1\n' },
    )
    const result = resolveEnvironment(project, 'uat')
    if (!result.ok) {
      throw new Error(result.error)
    }
    const adapter = createWebAdapter(project, result.value.web)
    expect(adapter.generate({ envFile: result.value.envFile })[0].args.join(' ')).toContain('pnpm generate:uat')
    expect(adapter.outputDir).toBe('dist-uat')
    // 沒有環境覆蓋時仍是框架預設
    expect(createWebAdapter(project).outputDir).toBe('.output/public')
  })

  it('refuses a command-only config without an output directory', () => {
    const project = makeProject({})
    expect(() => createWebAdapter(project, { framework: 'vite', devCommand: 'd', buildCommand: 'b', frameworkExplicit: false })).toThrow(ConfigError)
  })
})

describe('env add / remove / list', () => {
  it('adds an environment, creates its env file from the example, and keeps the rest of the config', () => {
    const project = makeProject({ appDir: 'aqutter', plugins: [] })
    const result = addEnvironment(project, { name: 'uat', flavor: 'uat', web: { buildCommand: 'pnpm generate:uat' } })
    expect(result).toMatchObject({ envFile: '.env/.env.uat', createdEnvFile: true, missingFlavor: true })
    expect(readFileSync(join(root, '.env/.env.uat'), 'utf8')).toContain('KEY=example')
    const written = JSON.parse(readFileSync(join(root, 'aqutter.config.json'), 'utf8'))
    expect(written.environments.uat).toEqual({ flavor: 'uat', web: { buildCommand: 'pnpm generate:uat' } }) // 預設的 envFile 不寫
    expect(written.appDir).toBe('aqutter')
    // 加好後就能直接解析
    expect(resolveEnvironment(project, 'uat').ok).toBe(true)
  })

  it('copies from another environment with --from', () => {
    const project = makeProject({ environments: { dev: {} } }, { '.env/.env.dev': 'KEY=from-dev\n' })
    addEnvironment(project, { name: 'staging', from: 'dev' })
    expect(readFileSync(join(root, '.env/.env.staging'), 'utf8')).toContain('from-dev')
  })

  it('never overwrites an existing environment or an existing env file', () => {
    const project = makeProject({ environments: { uat: {} } }, { '.env/.env.uat': 'KEEP=1\n', '.env/.env.qa': 'KEEP=2\n' })
    expect(() => addEnvironment(project, { name: 'uat' })).toThrow(/已存在/)
    const result = addEnvironment(project, { name: 'qa' })
    expect(result.createdEnvFile).toBe(false)
    expect(readFileSync(join(root, '.env/.env.qa'), 'utf8')).toBe('KEEP=2\n')
  })

  it('rejects an invalid name before touching anything', () => {
    const project = makeProject({})
    expect(() => addEnvironment(project, { name: 'Bad Name' })).toThrow(/不合法/)
    expect(() => readFileSync(join(root, '.env/.env.Bad Name'))).toThrow()
  })

  it('removes only the config entry, and lists what is configured', () => {
    const project = makeProject({ environments: { uat: { flavor: 'uat' } } }, { '.env/.env.uat': 'K=1\n' })
    expect(listEnvironments(project)[0]).toMatch(/^uat {2}env=\.env\/\.env\.uat {2}flavor=uat/)
    expect(removeEnvironment(project, 'uat')).toBe('.env/.env.uat')
    expect(JSON.parse(readFileSync(join(root, 'aqutter.config.json'), 'utf8')).environments).toBeUndefined()
    expect(readFileSync(join(root, '.env/.env.uat'), 'utf8')).toBe('K=1\n') // env 檔保留
    expect(() => removeEnvironment(project, 'uat')).toThrow(/沒有環境/)
  })
})
