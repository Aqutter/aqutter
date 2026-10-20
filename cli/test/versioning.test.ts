import { describe, expect, it } from 'vitest'

import { diagnose } from '../src/commands/doctor.ts'
import type { Facts } from '../src/commands/doctor.ts'
import { planUpgrade } from '../src/commands/upgrade.ts'
import {
  lowerBound,
  parseFvmrc,
  parseLock,
  parsePubspec,
  readNpmSpecs,
  rewriteFvmrc,
  rewritePackageJson,
  rewritePubspec,
  satisfies,
} from '../src/versioning.ts'

const EXPECTED = {
  sdk: '>=3.13.0 <4.0.0',
  flutter: '>=3.47.4 <3.48.0',
  flutterVersion: '3.47.4',
  shellRef: '0.1.0',
}

// 舊專案：只有下限、ref 是舊版、有註解與 plugins 區塊
const OLD_PUBSPEC = `name: demo
version: 1.0.0+1

environment:
  sdk: '>=3.13.0 <4.0.0'
  flutter: '>=3.47.0'

dependencies:
  flutter:
    sdk: flutter

  # shell
  aqutter:
    git:
      url: https://github.com/Aqutter/aqutter.git
      path: shell
      ref: 0.0.0

  # aqutter-plugins:begin
  # aqutter-plugins:end

dev_dependencies:
  flutter_test:
    sdk: flutter
`

describe('parsePubspec', () => {
  it('reads environment and the git shell dependency', () => {
    expect(parsePubspec(OLD_PUBSPEC)).toEqual({
      sdk: '>=3.13.0 <4.0.0',
      flutter: '>=3.47.0',
      shell: { kind: 'git', ref: '0.0.0', url: 'https://github.com/Aqutter/aqutter.git', path: null },
    })
  })

  it('does not confuse `flutter:` under dependencies with environment.flutter', () => {
    const info = parsePubspec('environment:\n  sdk: \'>=3.13.0 <4.0.0\'\n\ndependencies:\n  flutter:\n    sdk: flutter\n')
    expect(info.flutter).toBeNull()
  })

  it('reads a path shell dependency', () => {
    const info = parsePubspec('dependencies:\n  aqutter:\n    path: ../../aqutter/shell\n')
    expect(info.shell).toEqual({ kind: 'path', ref: null, url: null, path: '../../aqutter/shell' })
  })

  it('strips quotes and trailing comments', () => {
    const info = parsePubspec('environment:\n  flutter: ">=3.47.4 <3.48.0"  # pinned\n')
    expect(info.flutter).toBe('>=3.47.4 <3.48.0')
  })
})

describe('rewritePubspec', () => {
  const target = { sdk: EXPECTED.sdk, flutter: EXPECTED.flutter, shellRef: EXPECTED.shellRef }

  it('updates flutter and the shell ref, and leaves everything else untouched', () => {
    const { text, changes } = rewritePubspec(OLD_PUBSPEC, target)
    expect(changes).toEqual([
      'environment.flutter: >=3.47.0 → >=3.47.4 <3.48.0',
      'aqutter ref: 0.0.0 → 0.1.0',
    ])
    expect(text).toBe(
      OLD_PUBSPEC
        .replace('flutter: \'>=3.47.0\'', 'flutter: \'>=3.47.4 <3.48.0\'')
        .replace('ref: 0.0.0', 'ref: 0.1.0'),
    )
  })

  it('is idempotent', () => {
    const once = rewritePubspec(OLD_PUBSPEC, target).text
    const twice = rewritePubspec(once, target)
    expect(twice.changes).toEqual([])
    expect(twice.text).toBe(once)
  })

  it('does not touch the ref when shellRef is null (path dependency)', () => {
    const { text, changes } = rewritePubspec(OLD_PUBSPEC, { ...target, shellRef: null })
    expect(changes.some(change => change.startsWith('aqutter ref'))).toBe(false)
    expect(text).toContain('ref: 0.0.0')
  })

  it('adds a missing environment.flutter after the last entry', () => {
    const { text } = rewritePubspec('environment:\n  sdk: \'>=3.13.0 <4.0.0\'\n\ndependencies:\n  flutter:\n    sdk: flutter\n', target)
    expect(text).toContain('environment:\n  sdk: \'>=3.13.0 <4.0.0\'\n  flutter: \'>=3.47.4 <3.48.0\'\n')
  })

  it('preserves CRLF line endings', () => {
    const crlf = OLD_PUBSPEC.replace(/\n/g, '\r\n')
    const { text } = rewritePubspec(crlf, target)
    expect(text.includes('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toContain('\n')
  })
})

describe('.fvmrc', () => {
  it('parses the flutter version', () => {
    expect(parseFvmrc('{"flutter":"3.47.4"}')).toBe('3.47.4')
    expect(parseFvmrc('not json')).toBeNull()
    expect(parseFvmrc('{}')).toBeNull()
  })

  it('creates, updates (keeping other fields) and leaves an up-to-date file alone', () => {
    expect(rewriteFvmrc(null, '3.47.4')).toEqual({ text: '{\n  "flutter": "3.47.4"\n}\n', changed: true })
    const updated = rewriteFvmrc('{"flutter":"3.38.6","flavors":{"a":"b"}}', '3.47.4')
    expect(JSON.parse(updated?.text ?? '')).toEqual({ flutter: '3.47.4', flavors: { a: 'b' } })
    const same = '{"flutter":"3.47.4"}'
    expect(rewriteFvmrc(same, '3.47.4')).toEqual({ text: same, changed: false })
  })

  it('refuses to overwrite content that is not a JSON object', () => {
    expect(rewriteFvmrc('not json', '3.47.4')).toBeNull()
    expect(rewriteFvmrc('[1]', '3.47.4')).toBeNull()
  })
})

describe('package.json', () => {
  const PACKAGE = `{
  "dependencies": {
    "@aqutter/aqutter": "github:Aqutter/aqutter#0.0.0&path:/client",
    "nuxt": "4.6.1"
  },
  "devDependencies": {
    "@aqutter/aqutter-cli": "github:Aqutter/aqutter#0.0.0&path:/cli"
  }
}
`

  it('reads the Aqutter github specs', () => {
    expect(readNpmSpecs(PACKAGE)).toEqual([
      { name: '@aqutter/aqutter', ref: '0.0.0' },
      { name: '@aqutter/aqutter-cli', ref: '0.0.0' },
    ])
  })

  it('rewrites only the ref and keeps formatting', () => {
    const { text, changes } = rewritePackageJson(PACKAGE, '0.1.0')
    expect(changes).toEqual(['@aqutter/aqutter: 0.0.0 → 0.1.0', '@aqutter/aqutter-cli: 0.0.0 → 0.1.0'])
    expect(text).toBe(PACKAGE.replace(/#0\.0\.0&/g, '#0.1.0&'))
    expect(rewritePackageJson(text, '0.1.0').changes).toEqual([])
  })

  it('ignores dependencies that are not Aqutter github specs', () => {
    expect(readNpmSpecs('{"dependencies":{"@aqutter/aqutter":"^1.0.0"}}')).toEqual([])
    expect(readNpmSpecs('not json')).toEqual([])
  })
})

describe('parseLock', () => {
  it('reads git packages and ignores hosted ones', () => {
    const lock = `# Generated by pub
packages:
  aqutter:
    dependency: "direct main"
    description:
      path: shell
      ref: "0.0.0"
      resolved-ref: "78761d13273cbfca1e50e9a24dad56efa37a280f"
      url: "https://github.com/Aqutter/aqutter.git"
    source: git
    version: "0.0.0"
  archive:
    dependency: transitive
    description:
      name: archive
      sha256: "abc"
      url: "https://pub.dev"
    source: hosted
    version: "4.0.9"
sdks:
  dart: ">=3.13.0 <4.0.0"
`
    expect(parseLock(lock)).toEqual({
      aqutter: {
        url: 'https://github.com/Aqutter/aqutter.git',
        ref: '0.0.0',
        resolvedRef: '78761d13273cbfca1e50e9a24dad56efa37a280f',
      },
    })
  })
})

describe('lowerBound', () => {
  it('takes the >= bound as the reference version', () => {
    expect(lowerBound('>=3.47.4 <3.48.0')).toBe('3.47.4')
    expect(lowerBound('<3.48.0')).toBeNull()
    expect(lowerBound('^3.47.0')).toBeNull()
  })
})

describe('satisfies', () => {
  it('handles the range forms used by the framework', () => {
    expect(satisfies('3.47.4', '>=3.47.4 <3.48.0')).toBe(true)
    expect(satisfies('3.47.9', '>=3.47.4 <3.48.0')).toBe(true)
    expect(satisfies('3.47.3', '>=3.47.4 <3.48.0')).toBe(false)
    expect(satisfies('3.48.0', '>=3.47.4 <3.48.0')).toBe(false)
    expect(satisfies('3.47.4', '3.47.4')).toBe(true)
  })

  it('returns null when it cannot tell', () => {
    expect(satisfies('3.47.4', '^3.47.0')).toBeNull()
    expect(satisfies('main', '>=3.47.4')).toBeNull()
  })
})

const upToDatePubspec = rewritePubspec(OLD_PUBSPEC, { sdk: EXPECTED.sdk, flutter: EXPECTED.flutter, shellRef: EXPECTED.shellRef }).text

const goodFacts = (): Facts => ({
  expected: EXPECTED,
  installedFlutter: '3.47.4',
  pubspec: parsePubspec(upToDatePubspec),
  fvmrc: null,
  npmSpecs: [{ name: '@aqutter/aqutter', ref: '0.1.0' }],
  lock: {
    aqutter: { url: 'https://github.com/Aqutter/aqutter.git', ref: '0.1.0', resolvedRef: 'a'.repeat(40) },
  },
  remote: { 'https://github.com/Aqutter/aqutter.git#0.1.0': 'a'.repeat(40) },
})

const levels = (facts: Facts): string[] => diagnose(facts).filter(f => f.level !== 'ok').map(f => `${f.level}:${f.title}`)

describe('diagnose', () => {
  it('reports no problems for an up-to-date project', () => {
    expect(levels(goodFacts())).toEqual([])
  })

  it('errors when Flutter is missing or outside the allowed range', () => {
    expect(levels({ ...goodFacts(), installedFlutter: null })[0]).toMatch(/^error:/)
    expect(levels({ ...goodFacts(), installedFlutter: '3.38.6' })[0]).toMatch(/^error:Flutter 版本不符/)
  })

  it('warns when Flutter is inside the range but not the reference version', () => {
    expect(levels({ ...goodFacts(), installedFlutter: '3.47.9' })[0]).toMatch(/^warn:/)
  })

  it('warns about an old pubspec, a stale ref and old npm refs', () => {
    const found = levels({
      ...goodFacts(),
      pubspec: parsePubspec(OLD_PUBSPEC),
      npmSpecs: [{ name: '@aqutter/aqutter', ref: '0.0.0' }],
    })
    expect(found).toHaveLength(3)
    expect(found.every(line => line.startsWith('warn:'))).toBe(true)
  })

  it('never asks for a .fvmrc: a project without one is fine', () => {
    const titles = diagnose({ ...goodFacts(), fvmrc: null }).map(f => f.title)
    expect(titles.some(title => title.includes('fvmrc'))).toBe(false)
  })

  it('checks an existing .fvmrc only', () => {
    expect(levels({ ...goodFacts(), fvmrc: { version: '3.47.4' } })).toEqual([])
    expect(levels({ ...goodFacts(), fvmrc: { version: '3.38.6' } })[0]).toMatch(/^warn:\.fvmrc 是 3\.38\.6/)
    expect(levels({ ...goodFacts(), fvmrc: { version: null } })[0]).toMatch(/^warn:\.fvmrc 不是合法/)
  })

  it('warns when the lock is behind the remote ref', () => {
    const facts = goodFacts()
    facts.remote = { 'https://github.com/Aqutter/aqutter.git#0.1.0': 'b'.repeat(40) }
    const found = levels(facts)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/lock 落後/)
  })

  it('does not query the remote when offline', () => {
    const facts = goodFacts()
    facts.remote = undefined
    expect(levels(facts)).toEqual([])
  })

  it('skips the ref check for a path dependency', () => {
    const pubspec = parsePubspec('environment:\n  sdk: \'>=3.13.0 <4.0.0\'\n  flutter: \'>=3.47.4 <3.48.0\'\n\ndependencies:\n  aqutter:\n    path: ../shell\n')
    expect(levels({ ...goodFacts(), pubspec })).toEqual([])
  })
})

describe('planUpgrade', () => {
  const PACKAGE = '{\n  "devDependencies": {\n    "@aqutter/aqutter-cli": "github:Aqutter/aqutter#0.0.0&path:/cli"\n  }\n}\n'

  it('plans pubspec and package.json, and asks for a pub upgrade for a git shell', () => {
    const plan = planUpgrade({ pubspec: OLD_PUBSPEC, fvmrc: null, packageJson: PACKAGE, keepShellRef: false }, EXPECTED)
    expect(plan.pubspec.changes).toHaveLength(2)
    expect(plan.fvmrc).toBeNull()
    expect(plan.packageJson?.changes).toEqual(['@aqutter/aqutter-cli: 0.0.0 → 0.1.0'])
    expect(plan.needsPubUpgrade).toBe(true)
  })

  it('keeps the shell ref when the config points the shell at a local path', () => {
    const plan = planUpgrade({ pubspec: OLD_PUBSPEC, fvmrc: null, packageJson: null, keepShellRef: true }, EXPECTED)
    expect(plan.pubspec.changes).toEqual(['environment.flutter: >=3.47.0 → >=3.47.4 <3.48.0'])
    expect(plan.packageJson).toBeNull()
  })

  it('updates an existing .fvmrc but never creates one', () => {
    const existing = planUpgrade({ pubspec: OLD_PUBSPEC, fvmrc: '{"flutter":"3.38.6"}', packageJson: null, keepShellRef: false }, EXPECTED)
    expect(existing.fvmrc).toEqual({ text: '{\n  "flutter": "3.47.4"\n}\n', changed: true })
    expect(planUpgrade({ pubspec: OLD_PUBSPEC, fvmrc: null, packageJson: null, keepShellRef: false }, EXPECTED).fvmrc).toBeNull()
  })

  it('flags an invalid .fvmrc instead of overwriting it', () => {
    const plan = planUpgrade({ pubspec: OLD_PUBSPEC, fvmrc: 'oops', packageJson: null, keepShellRef: false }, EXPECTED)
    expect(plan.fvmrc).toBe('invalid')
  })

  it('does not request a pub upgrade for a path dependency', () => {
    const pubspec = 'environment:\n  sdk: \'>=3.13.0 <4.0.0\'\n  flutter: \'>=3.47.4 <3.48.0\'\n\ndependencies:\n  aqutter:\n    path: ../shell\n'
    expect(planUpgrade({ pubspec, fvmrc: null, packageJson: null, keepShellRef: false }, EXPECTED).needsPubUpgrade).toBe(false)
  })
})
