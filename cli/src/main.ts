import { ConfigError, loadProject } from './config.ts'
import pkg from '../package.json'

const HELP = `aqutter ${pkg.version}

用法：aqutter <指令> [參數]

指令：
  init                 在既有網頁專案加入 Aqutter（產生 aqutter.config.json 與 Flutter App 目錄）
  dev [target]         同跑網頁 dev server 與 flutter run（target: macos|windows|linux|ios|ios-device|android|<device id>）
  seed                 產生靜態網頁並打包種子網頁包（同時交付 web_<env>_<版本>.zip）
  build <platform>     打包 App（apk|aab|ios|ipa|macos|windows|linux），含種子、簽章、交付
  env add|list|remove  管理設定檔裡的命名環境（env 檔、flavor、簽章、網頁指令覆蓋）
  flavor add [<name>]  為 Android / iOS / macOS 新增 flavor
  android gen-jks      產生 Android 簽章用 keystore 與 key.properties
  plugin create <name> 產生 Aqutter plugin 專案
  plugin add <pkg>     把 plugin 加入目前專案

通用旗標（dev / seed / build）：-e <環境名或 env 檔>（等同 --env=…）--x-env=<名稱> --flavor=<名稱>；詳見各指令說明。
`

const main = async (): Promise<void> => {
  const [command, ...rest] = process.argv.slice(2)
  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  if (command === '-v' || command === '--version') {
    console.log(pkg.version)
    return
  }
  if (command === 'init') {
    const { runInit } = await import('./commands/init.ts')
    await runInit(process.cwd(), rest)
    return
  }
  if (command === 'plugin') {
    const { runPlugin } = await import('./commands/plugin.ts')
    await runPlugin(process.cwd(), rest)
    return
  }

  const project = loadProject(process.cwd())
  switch (command) {
    case 'dev': {
      const { runDev } = await import('./commands/dev.ts')
      await runDev(project, rest)
      return
    }
    case 'seed': {
      const { runSeed } = await import('./commands/seed.ts')
      await runSeed(project, rest)
      return
    }
    case 'build': {
      const { runBuild } = await import('./commands/build.ts')
      await runBuild(project, rest)
      return
    }
    case 'env': {
      const { runEnv } = await import('./commands/env.ts')
      await runEnv(project, rest)
      return
    }
    case 'flavor': {
      if (rest[0] !== 'add') {
        throw new ConfigError('用法：aqutter flavor add [<name>]')
      }
      const { runFlavorAdd } = await import('./commands/flavorAdd.ts')
      await runFlavorAdd(project, rest.slice(1))
      return
    }
    case 'android': {
      if (rest[0] !== 'gen-jks') {
        throw new ConfigError('用法：aqutter android gen-jks')
      }
      const { runGenJks } = await import('./commands/genJks.ts')
      await runGenJks(project, rest.slice(1))
      return
    }
    default:
      throw new ConfigError(`未知指令「${command}」。執行 \`aqutter help\` 查看用法。`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
