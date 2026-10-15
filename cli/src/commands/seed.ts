// 種子產生 orchestrator：產生靜態網頁（帶指定 env 檔）→ 打包種子（syncSeed）
// → 交付一份到 <artifactsDir>/web_<env>_<seedVersion>.zip（OTA 上傳用；build 委派本指令，故同樣得到）。
// 與 dev/build 同一份 env 源、同一 `--env=` 慣例。
//
// 用法：aqutter seed [--env=<env 檔路徑>]
//   --env: env 檔路徑，相對專案根（預設為設定的 defaultDevEnv）。例：.env/.env.uat
//          找不到即中止，不做任何退回（見 shared.resolveEnvFile）

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

import type { Project } from '../config.ts'
import { IS_WIN, describeMissingEnv, envNameOf, parseArgs, resolveEnvFile } from '../shared.ts'
import { packSeed } from '../syncSeed.ts'
import { createWebAdapter } from '../web.ts'

const TAG = 'flutter:seed'

// 網頁包交付檔名前綴：它是 OTA 網頁包、版本是種子時戳，與 app 產物（app_<env>_<pubspec 版本>）是不同類交付物。
const WEB_ARTIFACT_NAME = 'web'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

export const runSeed = async (project: Project, argv: string[]): Promise<void> => {
  const { flags } = parseArgs(argv)
  const envPath = flags.env ?? project.config.defaultDevEnv

  const envFile = resolveEnvFile(project, envPath)
  if (!envFile) {
    return fail(describeMissingEnv(project, envPath))
  }
  // 交付檔名要用到環境名，打包前就先確認組得出來
  const envName = envNameOf(envFile)
  if (!envName) {
    return fail(`無法由 env 檔 \`${envFile}\` 推導環境名（檔名須為 .env.<環境> 形式，例如 ${project.config.envDir}/.env.uat）。`)
  }

  console.log(`[${TAG}] env=${envFile}`)

  const web = createWebAdapter(project)

  // 換 env 檔重打時，殘留的框架快取 / 產物會讓產物沿用**上一次**那份 env 的設定值。
  // 這是無聲的錯誤：檔案時間戳會更新、種子版本會遞增，只有打開產物才看得出打錯環境，
  // 最壞情況是把 dev URL 出到現場、或把現場 IP 出給測試機。種子只在打包時產生，
  // 多花一次完整重建的時間換掉整類錯誤是划算的，故一律清空後再產生。
  if (web.cleanDirs.length > 0) {
    console.log(`[${TAG}] clean: ${web.cleanDirs.join(' / ')}（避免沿用前一份 env 的設定值）`)
  }
  for (const dir of web.cleanDirs) {
    rmSync(join(project.root, dir), {
      recursive: true,
      force: true,
    })
  }

  for (const stepSpec of web.generate({ envFile })) {
    console.log(`[${TAG}] ${stepSpec.label}: ${stepSpec.command} ${stepSpec.args.join(' ')}`)
    const result = spawnSync(stepSpec.command, stepSpec.args, {
      cwd: project.root,
      stdio: 'inherit',
      shell: IS_WIN,
      env: {
        ...process.env,
        ...stepSpec.env,
      },
    })
    if (result.status !== 0) {
      fail(`步驟失敗：${stepSpec.label}（exit ${result.status ?? 'signal'}）。`)
    }
  }

  console.log(`[${TAG}] pack seed`)
  packSeed(project, web.outputDir)

  // 交付：seed-version.json 是 packSeed 剛寫的時戳（與 zip 內 version.json 同值），直接拿來命名
  const { version } = JSON.parse(readFileSync(project.seedVersion, 'utf8')) as { version: string }
  mkdirSync(project.artifactsDir, { recursive: true })
  const artifact = join(project.artifactsDir, `${WEB_ARTIFACT_NAME}_${envName}_${version}.zip`)
  copyFileSync(project.seedBundle, artifact)
  console.log(`[${TAG}] 完成（env=${envFile}）→ ${relative(project.root, artifact)}`)
}
