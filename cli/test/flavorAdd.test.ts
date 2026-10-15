import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FlavorAddError,
  addGradleFlavor,
  addXcodeConfigurations,
  listBuildConfigurations,
  pbxName,
  readAndroidApplicationId,
  readAndroidLabel,
  readBuildSetting,
  readPlistDisplayName,
  readXcodeIdentity,
  renderXcodeScheme,
  runnerConfigurationIds,
  setBuildSetting,
  wireAndroidLabel,
  wireDisplayName,
} from '../src/commands/flavorAdd.ts'

const GRADLE = `android {
    defaultConfig {
        applicationId = "com.acme.app"
        versionName = flutter.versionName
    }

    buildTypes {
        release {
        }
    }
}
`

const MANIFEST = `<manifest>
    <application
        android:label="My App"
        android:name="io.flutter.app.FlutterApplication">
    </application>
</manifest>
`

const gradleFlavor = { name: 'uat', applicationId: 'com.acme.app.uat', displayName: 'My App UAT' }
const xcodeFlavor = { name: 'uat', bundleId: 'com.acme.app.uat', displayName: 'My App UAT' }

// 最小 pbxproj：Runner target 的 Debug / Release / Profile 各一個 configuration + 一個 RunnerTests 的 Debug。
const RUNNER_DEBUG = 'AAAAAAAAAAAAAAAAAAAAAAA1'
const RUNNER_RELEASE = 'AAAAAAAAAAAAAAAAAAAAAAA2'
const RUNNER_PROFILE = 'AAAAAAAAAAAAAAAAAAAAAAA3'
const TESTS_DEBUG = 'BBBBBBBBBBBBBBBBBBBBBBB1'

const config = (id: string, name: string, extra = '') => `\t\t${id} /* ${name} */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
${extra}\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t};
\t\t\tname = ${name};
\t\t};
`

const PBXPROJ = `// !$*UTF8*$!
/* Begin XCBuildConfiguration section */
${config(RUNNER_DEBUG, 'Debug', '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.acme.app;\n')}${config(RUNNER_RELEASE, 'Release', '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.acme.app;\n')}${config(RUNNER_PROFILE, 'Profile', '\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.acme.app;\n')}${config(TESTS_DEBUG, 'Debug')}/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\tCCCCCCCCCCCCCCCCCCCCCCC1 /* Build configuration list for PBXNativeTarget "Runner" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${RUNNER_DEBUG} /* Debug */,
\t\t\t\t${RUNNER_RELEASE} /* Release */,
\t\t\t\t${RUNNER_PROFILE} /* Profile */,
\t\t\t);
\t\t\tdefaultConfigurationName = Release;
\t\t};
\t\tCCCCCCCCCCCCCCCCCCCCCCC2 /* Build configuration list for PBXNativeTarget "RunnerTests" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${TESTS_DEBUG} /* Debug */,
\t\t\t);
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End XCConfigurationList section */
`

const PLIST = `<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>$(DEVELOPMENT_LANGUAGE)</string>
\t<key>CFBundleDisplayName</key>
\t<string>My App</string>
</dict>
`

const PLIST_WITHOUT_NAME = `<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>$(DEVELOPMENT_LANGUAGE)</string>
</dict>
`

let counter = 0
const fakeId = () => {
  counter += 1
  return `F${String(counter).padStart(23, '0')}`
}

describe('Android', () => {
  it('讀 applicationId 與 label', () => {
    expect(readAndroidApplicationId(GRADLE)).toBe('com.acme.app')
    expect(readAndroidLabel(MANIFEST)).toBe('My App')
    expect(readAndroidLabel('<application android:label="@string/app_name">')).toBeNull()
  })

  it('wireAndroidLabel 接線一次，再次呼叫冪等', () => {
    const once = wireAndroidLabel(GRADLE, MANIFEST)
    expect(once.changed).toBe(true)
    expect(once.manifest).toContain('android:label="@string/app_name"')
    expect(once.gradle).toContain('resValues = true')
    expect(once.gradle).toContain('resValue("string", "app_name", "My App")')
    const twice = wireAndroidLabel(once.gradle, once.manifest)
    expect(twice.changed).toBe(false)
    expect(twice.gradle).toBe(once.gradle)
    expect(twice.manifest).toBe(once.manifest)
  })

  it('addGradleFlavor 無 productFlavors 時連同 flavorDimensions 插在 buildTypes 之前', () => {
    const result = addGradleFlavor(GRADLE, gradleFlavor)
    expect(result).toContain('flavorDimensions += "env"')
    expect(result).toContain('create("uat") {')
    expect(result).toContain('applicationId = "com.acme.app.uat"')
    expect(result.indexOf('productFlavors')).toBeLessThan(result.indexOf('buildTypes'))
  })

  it('addGradleFlavor 已有 productFlavors 時追加；同名則中止', () => {
    const first = addGradleFlavor(GRADLE, gradleFlavor)
    const second = addGradleFlavor(first, { ...gradleFlavor, name: 'stg' })
    expect(second).toContain('create("uat")')
    expect(second).toContain('create("stg")')
    expect(second.match(/flavorDimensions/g)).toHaveLength(1)
    expect(() => addGradleFlavor(second, gradleFlavor)).toThrow(FlavorAddError)
  })

  it('跳脫 Kotlin 字串', () => {
    const result = addGradleFlavor(GRADLE, { ...gradleFlavor, displayName: 'A "B" \\C' })
    expect(result).toContain('"A \\"B\\" \\\\C"')
  })

  it('找不到插入點時丟 FlavorAddError', () => {
    expect(() => addGradleFlavor('android {}', gradleFlavor)).toThrow(FlavorAddError)
  })
})

describe('pbxproj', () => {
  it('列出 configuration 與 Runner target 的 ID', () => {
    expect(listBuildConfigurations(PBXPROJ).map(block => block.id)).toEqual([RUNNER_DEBUG, RUNNER_RELEASE, RUNNER_PROFILE, TESTS_DEBUG])
    expect([...runnerConfigurationIds(PBXPROJ)]).toEqual([RUNNER_DEBUG, RUNNER_RELEASE, RUNNER_PROFILE])
  })

  it('readBuildSetting / setBuildSetting（字母序插入、既有就改值）', () => {
    const block = listBuildConfigurations(PBXPROJ)[1].text
    expect(readBuildSetting(block, 'PRODUCT_BUNDLE_IDENTIFIER')).toBe('com.acme.app')
    expect(readBuildSetting(block, 'APP_DISPLAY_NAME')).toBeNull()
    const added = setBuildSetting(block, 'APP_DISPLAY_NAME', '"X Y"')
    const lines = added.split('\n')
    expect(lines[3]).toBe('\t\t\t\tAPP_DISPLAY_NAME = "X Y";')
    expect(readBuildSetting(added, 'APP_DISPLAY_NAME')).toBe('X Y')
    expect(readBuildSetting(setBuildSetting(added, 'APP_DISPLAY_NAME', 'Z'), 'APP_DISPLAY_NAME')).toBe('Z')
  })

  it('readXcodeIdentity 先讀 config，沒有再退 xcconfig', () => {
    expect(readXcodeIdentity(PBXPROJ, null)).toEqual({ bundleId: 'com.acme.app', displayName: null })
    const noBundle = PBXPROJ.replaceAll('\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.acme.app;\n', '')
    expect(readXcodeIdentity(noBundle, 'PRODUCT_BUNDLE_IDENTIFIER = com.x.y\n').bundleId).toBe('com.x.y')
  })

  it('pbxName 含 - 時加引號', () => {
    expect(pbxName('Release')).toBe('Release')
    expect(pbxName('Release-uat')).toBe('"Release-uat"')
  })

  it('addXcodeConfigurations 複製三種 mode 並追加到各 list；同名則中止', () => {
    counter = 0
    const result = addXcodeConfigurations(PBXPROJ, xcodeFlavor, fakeId)
    const names = listBuildConfigurations(result).map(block => block.name)
    expect(names).toEqual(expect.arrayContaining(['Debug-uat', 'Release-uat', 'Profile-uat']))
    const release = listBuildConfigurations(result).find(block => block.name === 'Release-uat')
    expect(release?.text).toContain('name = "Release-uat";')
    expect(readBuildSetting(release?.text ?? '', 'PRODUCT_BUNDLE_IDENTIFIER')).toBe('com.acme.app.uat')
    expect(readBuildSetting(release?.text ?? '', 'APP_DISPLAY_NAME')).toBe('My App UAT')
    // RunnerTests 的 Debug 副本不改身分
    const testsClone = listBuildConfigurations(result).find(block => block.name === 'Debug-uat' && !runnerConfigurationIds(result).has(block.id))
    expect(readBuildSetting(testsClone?.text ?? '', 'APP_DISPLAY_NAME')).toBeNull()
    // Runner list 追加 3 筆、RunnerTests list 追加 1 筆
    expect(result.match(/\/\* \w+-uat \*\/,/g)).toHaveLength(4)
    expect(() => addXcodeConfigurations(result, xcodeFlavor, fakeId)).toThrow(FlavorAddError)
  })
})

describe('Info.plist', () => {
  it('wireDisplayName 把顯示名移進 Runner 的 configuration，冪等', () => {
    expect(readPlistDisplayName(PLIST)).toBe('My App')
    const once = wireDisplayName(PBXPROJ, PLIST, 'Fallback')
    expect(once.changed).toBe(true)
    expect(readPlistDisplayName(once.plist)).toBe('$(APP_DISPLAY_NAME)')
    expect(once.pbxproj.match(/APP_DISPLAY_NAME = "My App";/g)).toHaveLength(3)
    const twice = wireDisplayName(once.pbxproj, once.plist, 'Fallback')
    expect(twice.changed).toBe(false)
    expect(twice.pbxproj).toBe(once.pbxproj)
    expect(twice.plist).toBe(once.plist)
  })

  it('沒有 CFBundleDisplayName 時補在 CFBundleDevelopmentRegion 之後並用 fallback', () => {
    const wired = wireDisplayName(PBXPROJ, PLIST_WITHOUT_NAME, 'Fallback')
    expect(wired.plist).toContain('<string>$(DEVELOPMENT_LANGUAGE)</string>\n\t<key>CFBundleDisplayName</key>\n\t<string>$(APP_DISPLAY_NAME)</string>')
    expect(wired.pbxproj).toContain('APP_DISPLAY_NAME = "Fallback";')
  })

  it('找不到接線位置時中止', () => {
    expect(() => wireDisplayName(PBXPROJ, '<dict></dict>', 'x')).toThrow(FlavorAddError)
  })
})

describe('scheme', () => {
  it('所有 buildConfiguration 改指向 <Mode>-<name>', () => {
    const scheme = 'buildConfiguration = "Debug"\nbuildConfiguration = "Release"\nbuildConfiguration = "Profile"\n'
    expect(renderXcodeScheme(scheme, 'uat')).toBe('buildConfiguration = "Debug-uat"\nbuildConfiguration = "Release-uat"\nbuildConfiguration = "Profile-uat"\n')
  })
})

describe('真實範本', () => {
  const templateApp = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', 'app')
  const read = (...segments: string[]) => readFileSync(join(templateApp, ...segments), 'utf8')

  it('Android：接線 + flavor，冪等且含 flavor 名', () => {
    const gradle = read('android', 'app', 'build.gradle.kts')
    const manifest = read('android', 'app', 'src', 'main', 'AndroidManifest.xml')
    const wired = wireAndroidLabel(gradle, manifest)
    const again = wireAndroidLabel(wired.gradle, wired.manifest)
    expect(again).toEqual({ gradle: wired.gradle, manifest: wired.manifest, changed: false })
    const added = addGradleFlavor(wired.gradle, gradleFlavor)
    expect(added).toContain('create("uat")')
    expect(() => addGradleFlavor(added, gradleFlavor)).toThrow(FlavorAddError)
  })

  for (const platform of ['ios', 'macos']) {
    it(`${platform}：接線 + 複製 configuration + scheme，冪等且含 flavor 名`, () => {
      const pbxproj = read(platform, 'Runner.xcodeproj', 'project.pbxproj')
      const plist = read(platform, 'Runner', 'Info.plist')
      const wired = wireDisplayName(pbxproj, plist, 'App')
      const again = wireDisplayName(wired.pbxproj, wired.plist, 'App')
      expect(again.changed).toBe(false)
      expect(again.pbxproj).toBe(wired.pbxproj)
      expect(again.plist).toBe(wired.plist)

      const added = addXcodeConfigurations(wired.pbxproj, xcodeFlavor)
      expect(added).toContain('Release-uat')
      expect(listBuildConfigurations(added).filter(block => block.name.endsWith('-uat')).length).toBeGreaterThanOrEqual(3)
      expect(() => addXcodeConfigurations(added, xcodeFlavor)).toThrow(FlavorAddError)

      const scheme = renderXcodeScheme(read(platform, 'Runner.xcodeproj', 'xcshareddata', 'xcschemes', 'Runner.xcscheme'), 'uat')
      expect(scheme).toContain('buildConfiguration = "Release-uat"')
      expect(renderXcodeScheme(scheme, 'uat')).toBe(scheme)
    })
  }
})
