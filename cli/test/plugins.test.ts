import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { applyPubspecBlock, parseDescriptor, PUBSPEC_BEGIN, PUBSPEC_END, renderPluginsDart, renderPubspecBlock } from '../src/plugins.ts'
import { toClassName, toSnake } from '../src/commands/plugin.ts'
import { detectFramework, toAppName, toCamel, toDisplayName, usePathDependency } from '../src/commands/init.ts'
import { substitute } from '../src/template.ts'

const entry = { id: 'haptics', npm: '@x/aqutter-plugin-haptics', dart: { package: 'aqutter_plugin_haptics', class: 'HapticsPlugin' } }

describe('plugin descriptor', () => {
  it('accepts a valid descriptor', () => {
    expect(parseDescriptor({ schema: 1, id: 'haptics', dart: { package: 'aqutter_plugin_haptics', class: 'HapticsPlugin' } }, 'x').id).toBe('haptics')
  })
  it('rejects bad ids, packages and classes', () => {
    const base = { schema: 1, id: 'ok', dart: { package: 'p', class: 'C' } }
    expect(() => parseDescriptor({ ...base, id: 'Bad.Id' }, 'x')).toThrow(/id/)
    expect(() => parseDescriptor({ ...base, dart: { package: 'P', class: 'C' } }, 'x')).toThrow(/dart.package/)
    expect(() => parseDescriptor({ ...base, dart: { package: 'p', class: 'c' } }, 'x')).toThrow(/dart.class/)
    expect(() => parseDescriptor({ ...base, schema: 2 }, 'x')).toThrow(/schema/)
    expect(() => parseDescriptor('nope', 'x')).toThrow(/JSON/)
  })
})

describe('plugin sync output', () => {
  it('renders an empty registry', () => {
    expect(renderPluginsDart([])).toContain('<AqutterPlugin>[];')
  })
  it('renders imports and instances', () => {
    const dart = renderPluginsDart([entry])
    expect(dart).toContain("import 'package:aqutter_plugin_haptics/aqutter_plugin_haptics.dart';")
    expect(dart).toContain('  HapticsPlugin(),')
  })
  it('renders pubspec path dependencies relative to the app dir', () => {
    expect(renderPubspecBlock([entry], '/proj', '/proj/aqutter')).toEqual([
      '  aqutter_plugin_haptics:',
      '    path: ../node_modules/@x/aqutter-plugin-haptics',
    ])
  })
  it('replaces only the managed block and is idempotent', () => {
    const pubspec = `dependencies:\n  flutter:\n${PUBSPEC_BEGIN}\n  old:\n    path: x\n${PUBSPEC_END}\n\ndev:\n`
    const once = applyPubspecBlock(pubspec, ['  new:', '    path: y'])
    expect(once).toContain('  new:')
    expect(once).not.toContain('  old:')
    expect(applyPubspecBlock(once, ['  new:', '    path: y'])).toBe(once)
    expect(applyPubspecBlock(once, [])).not.toContain('  new:')
  })
  it('refuses a pubspec without markers', () => {
    expect(() => applyPubspecBlock('dependencies:\n', [])).toThrow(/標記/)
  })
})

describe('naming helpers', () => {
  it('derives class and snake names', () => {
    expect(toClassName('native-view')).toBe('NativeView')
    expect(toSnake('native-view')).toBe('native_view')
  })
  it('derives app names', () => {
    expect(toAppName('@scope/My-App')).toBe('my_app')
    expect(toAppName('123')).toBe('app_123')
    expect(toCamel('sample_web')).toBe('sampleWeb')
    expect(toDisplayName('sample_web')).toBe('Sample Web')
  })
  it('detects nothing in an empty directory', () => {
    expect(detectFramework('/nonexistent-dir')).toBeNull()
  })
  it('switches the shell dependency to a path', () => {
    const pubspec = '  aqutter:\n    git:\n      url: u\n      path: shell\n      ref: 0.1.0\n\n  other: 1\n'
    expect(usePathDependency(pubspec, '../shell')).toBe('  aqutter:\n    path: ../shell\n\n  other: 1\n')
  })
})

const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name)
  return statSync(full).isDirectory() ? listFiles(full) : [full]
})

describe('templates', () => {
  const root = join(import.meta.dirname, '..', 'template')
  const known = {
    app: ['appName', 'appNameCamel', 'orgId', 'orgPath', 'displayName', 'shellRef'],
    plugin: ['id', 'idSnake', 'className', 'dartPackage', 'npmName', 'shellRef', 'clientRef'],
  }
  for (const [kind, keys] of Object.entries(known)) {
    it(`${kind} template only uses known variables`, () => {
      const used = new Set<string>()
      for (const file of listFiles(join(root, kind))) {
        const text = readFileSync(file).toString('latin1') + file
        for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
          used.add(match[1])
        }
      }
      // Windows runner 的 {{NO_DEPENDENCIES}} 是 Flutter 自己的標記，不是範本變數
      used.delete('NO_DEPENDENCIES')
      expect([...used].filter(name => !keys.includes(name))).toEqual([])
    })
    it(`${kind} template leaves no placeholder after substitution`, () => {
      const values = Object.fromEntries(keys.map(key => [key, 'x']))
      for (const file of listFiles(join(root, kind))) {
        const out = substitute(readFileSync(file).toString('latin1'), values)
        expect(out.replace('{{NO_DEPENDENCIES}}', '')).not.toMatch(/\{\{\w+\}\}/)
      }
    })
  }
})
