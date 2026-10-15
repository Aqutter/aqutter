import { describe, expect, it } from 'vitest'
import {
  buildDistinguishedName,
  buildKeyProperties,
  buildKeytoolArgs,
  escapeDnValue,
  isValidPassword,
  keytoolCandidates,
  normalizeJksName,
  parseValidityYears,
} from '../src/commands/genJks.ts'

describe('genJks helpers', () => {
  it('keytoolCandidates: PATH 優先，JAVA_HOME 其次', () => {
    expect(keytoolCandidates(undefined, 'keytool')).toEqual(['keytool'])
    const withHome = keytoolCandidates('/jdk', 'keytool')
    expect(withHome[0]).toBe('keytool')
    expect(withHome[1]).toMatch(/jdk.bin.keytool$/)
  })

  it('normalizeJksName 補副檔名且不重複', () => {
    expect(normalizeJksName('foo')).toBe('foo.jks')
    expect(normalizeJksName('foo.JKS')).toBe('foo.JKS')
  })

  it('escapeDnValue 跳脫逗號等特殊字元', () => {
    expect(escapeDnValue('A, B')).toBe('A\\, B')
    expect(buildDistinguishedName({
      commonName: 'a,b', organizationalUnit: 'u', organization: 'o', locality: 'l', country: 'TW',
    })).toBe('CN=a\\,b, OU=u, O=o, L=l, C=TW')
  })

  it('密碼與年數驗證', () => {
    expect(isValidPassword('12345')).toBe(false)
    expect(isValidPassword('123456')).toBe(true)
    expect(parseValidityYears('99')).toBe(99)
    expect(parseValidityYears('0')).toBeNull()
    expect(parseValidityYears('1.5')).toBeNull()
    expect(parseValidityYears('abc')).toBeNull()
  })

  it('buildKeyProperties 內容格式', () => {
    const content = buildKeyProperties({ jksName: 'x.jks', alias: 'k', password: 'secret1' })
    expect(content).toContain('storePassword=secret1')
    expect(content).toContain('keyPassword=secret1')
    expect(content).toContain('keyAlias=k')
    expect(content).toContain('storeFile=../x.jks')
    expect(content.endsWith('\n')).toBe(true)
  })

  it('buildKeytoolArgs 不含明文密碼', () => {
    const args = buildKeytoolArgs({ jksPath: '/a.jks', alias: 'k', validityDays: 365, distinguishedName: 'CN=x' })
    expect(args).toContain('-storepass:env')
    expect(args).toContain('365')
  })
})
