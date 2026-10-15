// Android release 簽章 keystore 產生器：以問答方式蒐集參數後呼叫 JDK 的 `keytool -genkeypair`，
// 並順帶寫出 gradle 簽章設定要讀的 `key.properties`。
//
// 用法：aqutter android gen-jks
// 產出：<appDir>/android/<name>.jks 與 <appDir>/android/key.properties
//       兩者皆已被 <appDir>/android/.gitignore 忽略，請自行妥善備份。
//
// 單一份實作供 Windows / macOS / Linux 共用，只依賴 Node 與 JDK 的 keytool。
// 密碼一律經環境變數交給 keytool（`-storepass:env` / `-keypass:env`），
// 不放在命令列參數上，避免出現在 process list 與 shell history。
import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Project } from '../config.ts'
import { IS_WIN, createPrompter } from '../shared.ts'

const TAG = 'android:gen-jks'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

// gradle 的 `file()` 相對於 app 模組（android/app/），keystore 在上一層。
const STORE_FILE_PREFIX_FROM_APP_MODULE = '../'

const JKS_EXTENSION = '.jks'
const DEFAULT_JKS_NAME = 'app-release'
const DEFAULT_ALIAS = 'app'
const DEFAULT_VALIDITY_YEARS = 99
const DEFAULT_LOCALITY = 'Taipei'
const DEFAULT_COUNTRY = 'TW'
const DAYS_PER_YEAR = 365

// keytool 對密碼的最小長度要求
export const MIN_PASSWORD_LENGTH = 6

// 密碼經此環境變數交給 keytool（`-storepass:env KS_PASS`）
const PASSWORD_ENV_KEY = 'KS_PASS'

const KEY_ALGORITHM = 'RSA'
const KEY_SIZE = '2048'
const STORE_TYPE = 'JKS'

// keytool 執行檔名；PATH 找不到時退而從 JAVA_HOME/bin 找。
const KEYTOOL_BIN = IS_WIN ? 'keytool.exe' : 'keytool'

/** keytool 候選清單：先 PATH，再 JAVA_HOME/bin（有設才加入）。 */
export const keytoolCandidates = (javaHome: string | undefined, keytoolBin: string = KEYTOOL_BIN): string[] => {
  const candidates = [keytoolBin]
  if (javaHome) {
    candidates.push(join(javaHome, 'bin', keytoolBin))
  }
  return candidates
}

/** 找 keytool：依候選順序探測；都沒有回 null 交由呼叫端中止。 */
const locateKeytool = (): string | null => {
  return keytoolCandidates(process.env.JAVA_HOME).find((candidate) => {
    const probe = spawnSync(candidate, ['-help'], { stdio: 'ignore' })
    return probe.error === undefined
  }) ?? null
}

/** 密碼是否合格：長度不得少於 keytool 的最低要求。 */
export const isValidPassword = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH

/** 有效年數：必須是正整數。 */
export const parseValidityYears = (answer: string): number | null => {
  const years = Number(answer)
  return Number.isInteger(years) && years > 0 ? years : null
}

/** 補齊 .jks 副檔名，讓使用者輸入 `foo` 或 `foo.jks` 皆可。 */
export const normalizeJksName = (name: string): string => {
  return name.toLowerCase().endsWith(JKS_EXTENSION) ? name : `${name}${JKS_EXTENSION}`
}

/** RFC 2253：DN 值內的特殊字元需以反斜線跳脫，否則 keytool 會把逗號當欄位分隔。 */
export const escapeDnValue = (value: string): string => {
  return value.replace(/([,+"\\<>;])/g, '\\$1')
}

export interface DistinguishedName {
  commonName: string
  organizationalUnit: string
  organization: string
  locality: string
  country: string
}

/** 組出 keytool `-dname` 字串（各值已跳脫）。 */
export const buildDistinguishedName = (dn: DistinguishedName): string => {
  return [
    `CN=${escapeDnValue(dn.commonName)}`,
    `OU=${escapeDnValue(dn.organizationalUnit)}`,
    `O=${escapeDnValue(dn.organization)}`,
    `L=${escapeDnValue(dn.locality)}`,
    `C=${escapeDnValue(dn.country)}`,
  ].join(', ')
}

export interface KeyPropertiesInput {
  jksName: string
  alias: string
  password: string
}

/** Flutter 官方格式的 key.properties 內容；storeFile 相對於 android/app/（gradle `file()` 的基準）。 */
export const buildKeyProperties = ({ jksName, alias, password }: KeyPropertiesInput): string => {
  return [
    '# 由 aqutter android gen-jks 產生；已被 .gitignore 忽略，勿提交。',
    `storePassword=${password}`,
    `keyPassword=${password}`,
    `keyAlias=${alias}`,
    `storeFile=${STORE_FILE_PREFIX_FROM_APP_MODULE}${jksName}`,
    '',
  ].join('\n')
}

/** 組出 keytool 參數（密碼不在其中，改走環境變數）。 */
export const buildKeytoolArgs = (options: {
  jksPath: string
  alias: string
  validityDays: number
  distinguishedName: string
}): string[] => [
  '-genkeypair',
  '-v',
  '-keystore', options.jksPath,
  '-alias', options.alias,
  '-keyalg', KEY_ALGORITHM,
  '-keysize', KEY_SIZE,
  '-validity', String(options.validityDays),
  '-storetype', STORE_TYPE,
  '-dname', options.distinguishedName,
  '-storepass:env', PASSWORD_ENV_KEY,
  '-keypass:env', PASSWORD_ENV_KEY,
]

export const runGenJks = async (project: Project, argv: string[]): Promise<void> => {
  void argv

  // keystore 與 key.properties 的落點。Flutter 官方範例把兩者放在 android/，
  // 且該目錄的 .gitignore 已忽略 *.jks / key.properties。
  const androidDir = join(project.appDir, 'android')
  const keyPropertiesFile = join(androidDir, 'key.properties')
  const gitignoreLabel = `${project.config.appDir}/android/.gitignore`

  // 問答器：與 flavor add 共用同一套 readline 排隊 / 遮罩實作（見 shared.createPrompter）。
  const {
    askWithDefault, askRequired, askSecret, askYesNo, close: closePrompter,
  } = createPrompter({
    onClose: () => fail('輸入已結束，未變更任何檔案。'),
  })

  /** 密碼兩次比對，不符或過短就重來。 */
  const askPassword = async (): Promise<string> => {
    for (;;) {
      const first = await askSecret(`keystore 密碼（至少 ${MIN_PASSWORD_LENGTH} 字元，store 與 key 共用）：`)
      if (!isValidPassword(first)) {
        console.log(`  密碼長度不足 ${MIN_PASSWORD_LENGTH} 字元，請重新輸入。`)
        continue
      }
      const second = await askSecret('再輸入一次確認：')
      if (first === second) {
        return first
      }
      console.log('  兩次輸入不一致，請重新輸入。')
    }
  }

  /** 有效年數：正整數，空白採預設。 */
  const askValidityYears = async (): Promise<number> => {
    for (;;) {
      const years = parseValidityYears(await askWithDefault('憑證有效年數', String(DEFAULT_VALIDITY_YEARS)))
      if (years !== null) {
        return years
      }
      console.log('  請輸入正整數年數。')
    }
  }

  /** 逐欄詢問憑證主體；CN / OU / O 必填、無預設，L / C 給台灣預設。 */
  const askDistinguishedName = async (): Promise<string> => {
    console.log('\n--- 憑證主體資訊（會寫進憑證，安裝後不可更改）---')
    const commonName = await askRequired('憑證擁有者名稱（CN，公司名或產品名，例：MyCompany）')
    const organizationalUnit = await askRequired('部門 / 單位名稱（OU，例：Mobile）')
    const organization = await askRequired('公司 / 組織名稱（O，例：My Company Ltd.）')
    const locality = await askWithDefault('所在城市（L）', DEFAULT_LOCALITY)
    const country = await askWithDefault('國家代碼（C，兩碼）', DEFAULT_COUNTRY)
    return buildDistinguishedName({
      commonName, organizationalUnit, organization, locality, country,
    })
  }

  /**
   * 已存在的檔案要先取得覆寫同意，否則中止——蓋掉正式簽章金鑰是不可逆的。
   * 同意後先刪除舊檔：keytool 對既有 keystore 是「追加金鑰」，同名 alias 會直接報錯而非覆寫。
   */
  const ensureCanWrite = async (filePath: string, label: string): Promise<void> => {
    if (!existsSync(filePath)) {
      return
    }
    const overwrite = await askYesNo(`${label} 已存在（${relative(project.root, filePath)}），是否覆寫？`)
    if (!overwrite) {
      fail('已取消，未變更任何檔案。')
    }
    unlinkSync(filePath)
  }

  const runKeytool = (keytool: string, options: {
    jksPath: string
    alias: string
    validityDays: number
    distinguishedName: string
    password: string
  }): void => {
    const result = spawnSync(keytool, buildKeytoolArgs(options), {
      stdio: 'inherit',
      env: {
        ...process.env,
        [PASSWORD_ENV_KEY]: options.password,
      },
    })
    if (result.status !== 0) {
      fail(`keytool 執行失敗（exit ${result.status ?? 'signal'}）。`)
    }
  }

  // Step 1. 先確認工具在，別讓使用者答完一串問題才發現沒裝 JDK
  const keytool = locateKeytool()
  if (keytool === null) {
    return fail('找不到 keytool。請安裝 JDK 並確保 keytool 在 PATH 上，或設定 JAVA_HOME。')
  }

  console.log('=== 產生 Android release keystore ===')
  console.log(`產出目錄：${relative(project.root, androidDir)}\n`)

  // Step 2. 蒐集參數
  const jksName = normalizeJksName(await askWithDefault('keystore 檔名', `${DEFAULT_JKS_NAME}${JKS_EXTENSION}`))
  const alias = await askWithDefault('金鑰別名（alias）', DEFAULT_ALIAS)
  const password = await askPassword()
  const validityYears = await askValidityYears()
  const distinguishedName = await askDistinguishedName()

  // Step 3. 覆寫確認要在 keytool 之前，兩個檔案都問完才動手，避免只寫了一半
  const jksPath = join(androidDir, jksName)
  await ensureCanWrite(jksPath, 'keystore')
  await ensureCanWrite(keyPropertiesFile, 'key.properties')

  // Step 4. 產生 keystore 與 key.properties
  console.log(`\n執行 keytool（有效期 ${validityYears} 年，主體 ${distinguishedName}）…\n`)
  runKeytool(keytool, {
    jksPath,
    alias,
    validityDays: validityYears * DAYS_PER_YEAR,
    distinguishedName,
    password,
  })
  writeFileSync(keyPropertiesFile, buildKeyProperties({ jksName, alias, password }), 'utf8')

  console.log('\n完成：')
  console.log(`  keystore       → ${relative(project.root, jksPath)}`)
  console.log(`  key.properties → ${relative(project.root, keyPropertiesFile)}`)
  console.log(`兩個檔案皆已被 ${gitignoreLabel} 忽略，請自行備份 keystore 與密碼；遺失即無法再更新已上架的 App。`)
  closePrompter()
}
