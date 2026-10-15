import { describe, expect, it } from 'vitest'

import { FLUTTER_TARGET, HOST_PLATFORMS, PLATFORM_LABEL, SIGNING_SECTION, artifactStem } from '../src/commands/build.ts'
import { envNameOf } from '../src/shared.ts'

describe('artifactStem', () => {
  it('composes name_env_flavor_version', () => {
    expect(artifactStem('app', 'uat', 'uat', '1.0.0+1')).toBe('app_uat_uat_1.0.0+1')
  })

  it('skips the flavor when absent', () => {
    expect(artifactStem('app', 'prod', null, '1.2.3+4')).toBe('app_prod_1.2.3+4')
  })

  it('derives the env part from an env file path', () => {
    const envName = envNameOf('.env/.env.uat') as string
    expect(artifactStem('shop', envName, null, '2.0.0+7')).toBe('shop_uat_2.0.0+7')
  })
})

describe('platform tables', () => {
  it('maps aab to appbundle', () => {
    expect(FLUTTER_TARGET.aab).toBe('appbundle')
  })

  it('only offers known platforms with labels per host', () => {
    for (const platforms of Object.values(HOST_PLATFORMS)) {
      for (const platform of platforms) {
        expect(FLUTTER_TARGET[platform]).toBeDefined()
        expect(PLATFORM_LABEL[platform]).toBeDefined()
      }
    }
  })

  it('signs only ipa / macos / windows', () => {
    expect(Object.keys(SIGNING_SECTION).sort()).toEqual(['ipa', 'macos', 'windows'])
    expect(SIGNING_SECTION.ipa).toBe('ios')
  })
})
