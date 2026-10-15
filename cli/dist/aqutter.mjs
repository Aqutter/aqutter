#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
var CONFIG_FILE, FRAMEWORKS, DEFAULT_CONFIG, ConfigError, isRecord, findProjectRoot, parseConfig, createProject, loadProject;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    CONFIG_FILE = "aqutter.config.json";
    FRAMEWORKS = ["nuxt", "vite", "next", "custom"];
    DEFAULT_CONFIG = {
      appDir: "aqutter",
      envDir: ".env",
      defaultDevEnv: ".env/.env.dev",
      defaultProdEnv: ".env/.env.prod",
      defaultPort: 3e3,
      artifactsDir: "artifacts",
      artifactName: "app",
      web: { framework: "vite" },
      shell: {},
      plugins: []
    };
    ConfigError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "ConfigError";
      }
    };
    isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    findProjectRoot = (cwd) => {
      let dir = resolve(cwd);
      for (; ; ) {
        if (existsSync(join(dir, CONFIG_FILE))) {
          return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
          return null;
        }
        dir = parent;
      }
    };
    parseConfig = (raw) => {
      if (!isRecord(raw)) {
        throw new ConfigError(`${CONFIG_FILE} \u5FC5\u9808\u662F JSON \u7269\u4EF6\u3002`);
      }
      const web = isRecord(raw.web) ? raw.web : {};
      const shell = isRecord(raw.shell) ? raw.shell : {};
      const merged = {
        ...DEFAULT_CONFIG,
        ...raw,
        web: { ...DEFAULT_CONFIG.web, ...web },
        shell: { ...DEFAULT_CONFIG.shell, ...shell }
      };
      if (!FRAMEWORKS.includes(merged.web.framework)) {
        throw new ConfigError(`web.framework \u5FC5\u9808\u662F ${FRAMEWORKS.join(" / ")}\uFF08\u76EE\u524D\uFF1A${String(merged.web.framework)}\uFF09\u3002`);
      }
      if (merged.web.framework === "custom" && !merged.web.custom?.dev) {
        throw new ConfigError("web.framework \u70BA custom \u6642\uFF0C\u5FC5\u9808\u63D0\u4F9B web.custom.dev \u8207 web.custom.generate\uFF0C\u4E14 web.outputDir \u9700\u6307\u5411\u975C\u614B\u7522\u7269\u76EE\u9304\u3002");
      }
      if (merged.web.framework === "custom" && (!merged.web.custom?.generate || !merged.web.outputDir)) {
        throw new ConfigError("web.framework \u70BA custom \u6642\uFF0C\u5FC5\u9808\u63D0\u4F9B web.custom.generate \u8207 web.outputDir\u3002");
      }
      if (!Array.isArray(merged.plugins)) {
        throw new ConfigError("plugins \u5FC5\u9808\u662F\u9663\u5217\u3002");
      }
      if (!Number.isInteger(merged.defaultPort) || merged.defaultPort < 1 || merged.defaultPort > 65535) {
        throw new ConfigError(`defaultPort \u5FC5\u9808\u662F 1\u201365535 \u7684\u6574\u6578\uFF08\u76EE\u524D\uFF1A${String(merged.defaultPort)}\uFF09\u3002`);
      }
      for (const key of ["appDir", "envDir", "defaultDevEnv", "defaultProdEnv", "artifactsDir", "artifactName"]) {
        if (typeof merged[key] !== "string" || merged[key] === "") {
          throw new ConfigError(`${key} \u5FC5\u9808\u662F\u975E\u7A7A\u5B57\u4E32\u3002`);
        }
      }
      return merged;
    };
    createProject = (root, config) => {
      const appDir = resolve(root, config.appDir);
      const seedDir = join(appDir, "assets", "seed");
      return {
        root,
        config,
        appDir,
        artifactsDir: resolve(root, config.artifactsDir),
        seedDir,
        seedBundle: join(seedDir, "web-bundle.zip"),
        seedVersion: join(seedDir, "seed-version.json")
      };
    };
    loadProject = (cwd) => {
      const root = findProjectRoot(cwd);
      if (root === null) {
        throw new ConfigError(`\u627E\u4E0D\u5230 ${CONFIG_FILE}\u3002\u8ACB\u5728\u5C08\u6848\u6839\u76EE\u9304\u57F7\u884C \`aqutter init\`\u3002`);
      }
      const file = join(root, CONFIG_FILE);
      let raw;
      try {
        raw = JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        throw new ConfigError(`${CONFIG_FILE} \u4E0D\u662F\u5408\u6CD5\u7684 JSON\uFF1A${error.message}`);
      }
      return createProject(root, parseConfig(raw));
    };
  }
});

// package.json
var package_default;
var init_package = __esm({
  "package.json"() {
    package_default = {
      name: "@aqutter/aqutter-cli",
      version: "0.1.0",
      description: "Aqutter CLI\uFF1A\u628A\u65E2\u6709\u7DB2\u9801\u5C08\u6848\u63A5\u4E0A Aqutter \u6BBC\uFF0C\u63D0\u4F9B dev / build / seed / flavor / \u7C3D\u7AE0 \u7B49\u6307\u4EE4\u3002",
      type: "module",
      license: "Apache-2.0",
      bin: {
        aqutter: "./dist/aqutter.mjs"
      },
      files: [
        "dist",
        "template"
      ],
      engines: {
        node: ">=20"
      },
      scripts: {
        build: "node scripts/build.mjs",
        typecheck: "tsc --noEmit",
        test: "vitest run"
      },
      devDependencies: {
        "@types/node": "^22.10.0",
        esbuild: "^0.25.0",
        typescript: "^5.7.0",
        vitest: "^3.0.0"
      },
      dependencies: {
        fflate: "^0.8.2"
      }
    };
  }
});

// src/shared.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync2, lstatSync, mkdirSync, readFileSync as readFileSync2, readdirSync, statSync } from "node:fs";
import { basename, join as join2 } from "node:path";
import readline from "node:readline";
var MIN_PORT, MAX_PORT, IS_WIN, parseArgs, resolvePort, ensureSeedDir, StepFailure, createStep, resolveEnvFile, describeMissingEnv, envNameOf, readAppVersion, ENTRY_KIND, walk, collectFiles, collectEntries, MASK_CHAR, PASSTHROUGH_PREFIXES, isTerminalControl, createPrompter;
var init_shared = __esm({
  "src/shared.ts"() {
    "use strict";
    MIN_PORT = 1;
    MAX_PORT = 65535;
    IS_WIN = process.platform === "win32";
    parseArgs = (argv) => {
      const positional = [];
      const flags = {};
      for (const arg of argv) {
        const match = /^--([^=]+)=(.*)$/.exec(arg);
        if (match) {
          flags[match[1]] = match[2];
          continue;
        }
        positional.push(arg);
      }
      return {
        positional,
        flags
      };
    };
    resolvePort = (project, flags) => {
      if (flags.port === void 0) {
        return project.config.defaultPort;
      }
      const port = Number(flags.port);
      if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
        return null;
      }
      return port;
    };
    ensureSeedDir = (project) => {
      mkdirSync(project.seedDir, { recursive: true });
    };
    StepFailure = class extends Error {
      label;
      status;
      constructor(tag, label, status) {
        super(`[${tag}] \u6B65\u9A5F\u5931\u6557\uFF1A${label}\uFF08exit ${status ?? "signal"}\uFF09\u3002`);
        this.name = "StepFailure";
        this.label = label;
        this.status = status;
      }
    };
    createStep = (tag) => (label, command, args, cwd, secrets = [], env) => {
      const shown = args.map((arg) => secrets.includes(arg) ? "***" : arg);
      console.log(`
[${tag}] ${label}: ${command} ${shown.join(" ")}`);
      const result = spawnSync(command, args, {
        cwd,
        stdio: "inherit",
        shell: IS_WIN,
        env: env ?? process.env
      });
      if (result.status !== 0) {
        const failure = new StepFailure(tag, label, result.status);
        console.error(failure.message);
        throw failure;
      }
    };
    resolveEnvFile = (project, envPath) => {
      return existsSync2(join2(project.root, envPath)) ? envPath : null;
    };
    describeMissingEnv = (project, envPath) => {
      const dir = project.config.envDir;
      const relocated = [`${dir}/.env.${envPath}`, `${dir}/${envPath}`].find((candidate) => existsSync2(join2(project.root, candidate)));
      const hint = relocated ? `\uFF08\u5075\u6E2C\u5230 \`${relocated}\` \u5B58\u5728\u2014\u2014\`--env=\` \u5403\u7684\u662F\u76F8\u5C0D\u5C08\u6848\u6839\u7684\u8DEF\u5F91\uFF0C\u8ACB\u6539\u5BEB\u70BA \`--env=${relocated}\`\uFF09` : `\uFF08\`--env=\` \u5403\u7684\u662F\u76F8\u5C0D\u5C08\u6848\u6839\u7684\u8DEF\u5F91\uFF0C\u4F8B\u5982 \`--env=${dir}/.env.uat\`\uFF09`;
      return `\u627E\u4E0D\u5230 env \u6A94 \`${envPath}\`${hint}\u3002\u8ACB\u7531 ${dir}/.env.example \u8907\u88FD\u4E00\u4EFD\u3002`;
    };
    envNameOf = (envFile) => {
      const name = basename(envFile).replace(/^\.env\.?/, "");
      return name === "" ? null : name;
    };
    readAppVersion = (project) => {
      const pubspec = readFileSync2(join2(project.appDir, "pubspec.yaml"), "utf8");
      const match = /^version:\s*(\S+)/m.exec(pubspec);
      return match ? match[1] : null;
    };
    ENTRY_KIND = Object.freeze({
      file: "file",
      symlink: "symlink"
    });
    walk = (dir, { followSymlinks }) => {
      const entries = [];
      for (const name of readdirSync(dir)) {
        const full = join2(dir, name);
        const stats = followSymlinks ? statSync(full) : lstatSync(full);
        if (stats.isDirectory()) {
          entries.push(...walk(full, { followSymlinks }));
          continue;
        }
        entries.push({
          path: full,
          kind: stats.isSymbolicLink() ? ENTRY_KIND.symlink : ENTRY_KIND.file,
          mode: stats.mode
        });
      }
      return entries;
    };
    collectFiles = (dir) => {
      return walk(dir, { followSymlinks: true }).map((entry) => entry.path);
    };
    collectEntries = (dir) => {
      return walk(dir, { followSymlinks: false });
    };
    MASK_CHAR = "*";
    PASSTHROUGH_PREFIXES = ["\x1B[", "\r", "\n"];
    isTerminalControl = (text) => PASSTHROUGH_PREFIXES.some((prefix) => text.startsWith(prefix));
    createPrompter = ({ onClose }) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const bufferedLines = [];
      let resolvePendingLine = null;
      rl.on("line", (line) => {
        if (resolvePendingLine === null) {
          bufferedLines.push(line);
          return;
        }
        const resolve5 = resolvePendingLine;
        resolvePendingLine = null;
        resolve5(line);
      });
      rl.on("close", () => {
        if (resolvePendingLine !== null) {
          onClose();
        }
      });
      const readLine = () => {
        const buffered = bufferedLines.shift();
        if (buffered !== void 0) {
          return Promise.resolve(buffered);
        }
        return new Promise((resolve5) => {
          resolvePendingLine = resolve5;
        });
      };
      let masked = false;
      const writeToOutput = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (text) => {
        if (!masked || isTerminalControl(text)) {
          writeToOutput(text);
          return;
        }
        const prompt = rl.getPrompt();
        const visible = text.startsWith(prompt) ? prompt : "";
        writeToOutput(visible + MASK_CHAR.repeat(text.length - visible.length));
      };
      const ask = async (label, { secret = false } = {}) => {
        rl.setPrompt(label);
        rl.prompt();
        masked = secret;
        const answer = await readLine();
        masked = false;
        return secret ? answer : answer.trim();
      };
      const askWithDefault = async (label, defaultValue) => {
        const answer = await ask(`${label} [${defaultValue}]\uFF1A`);
        return answer === "" ? defaultValue : answer;
      };
      const askRequired = async (label) => {
        for (; ; ) {
          const answer = await ask(`${label}\uFF08\u5FC5\u586B\uFF09\uFF1A`);
          if (answer !== "") {
            return answer;
          }
          console.log("  \u6B64\u6B04\u4F4D\u4E0D\u53EF\u7A7A\u767D\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u3002");
        }
      };
      const askSecret = (label) => ask(label, { secret: true });
      const askYesNo = async (label) => {
        for (; ; ) {
          const answer = (await ask(`${label} (y/N)\uFF1A`)).toLowerCase();
          if (answer === "y" || answer === "yes") {
            return true;
          }
          if (answer === "" || answer === "n" || answer === "no") {
            return false;
          }
        }
      };
      return {
        ask,
        askWithDefault,
        askRequired,
        askSecret,
        askYesNo,
        close: () => rl.close()
      };
    };
  }
});

// src/template.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3, readdirSync as readdirSync2, statSync as statSync2, writeFileSync, copyFileSync } from "node:fs";
import { dirname as dirname2, join as join3, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";
var BINARY_EXTENSIONS, isBinary, substitute, findTemplateRoot, renderTree;
var init_template = __esm({
  "src/template.ts"() {
    "use strict";
    BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".ico",
      ".icns",
      ".jar",
      ".so",
      ".dll",
      ".a",
      ".ttf",
      ".otf",
      ".woff",
      ".woff2",
      ".keystore",
      ".jks",
      ".zip",
      ".gz",
      ".pdf"
    ]);
    isBinary = (path, content) => {
      const dot = path.lastIndexOf(".");
      if (dot !== -1 && BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase())) {
        return true;
      }
      return content.includes(0);
    };
    substitute = (text, variables) => {
      return text.replace(/\{\{(\w+)\}\}/g, (whole, key) => variables[key] ?? whole);
    };
    findTemplateRoot = () => {
      let dir = dirname2(fileURLToPath(import.meta.url));
      for (let depth = 0; depth < 6; depth += 1) {
        const candidate = join3(dir, "template");
        if (existsSync3(join3(candidate, "app"))) {
          return candidate;
        }
        dir = resolve2(dir, "..");
      }
      throw new Error("\u627E\u4E0D\u5230 Aqutter \u7BC4\u672C\u76EE\u9304\uFF08template/\uFF09\u3002CLI \u5B89\u88DD\u662F\u5426\u5B8C\u6574\uFF1F");
    };
    renderTree = (source, target, variables, { overwrite = false } = {}) => {
      const written = [];
      const skipped = [];
      const walk2 = (from, to) => {
        for (const name of readdirSync2(from)) {
          const src = join3(from, name);
          const dst = join3(to, substitute(name, variables));
          if (statSync2(src).isDirectory()) {
            walk2(src, dst);
            continue;
          }
          if (existsSync3(dst) && !overwrite) {
            skipped.push(dst);
            continue;
          }
          mkdirSync2(dirname2(dst), { recursive: true });
          const content = readFileSync3(src);
          if (isBinary(src, content)) {
            copyFileSync(src, dst);
          } else {
            writeFileSync(dst, substitute(content.toString("utf8"), variables));
          }
          written.push(dst);
        }
      };
      walk2(source, target);
      return { written, skipped };
    };
  }
});

// src/commands/init.ts
var init_exports = {};
__export(init_exports, {
  detectFramework: () => detectFramework,
  runInit: () => runInit,
  toAppName: () => toAppName,
  toCamel: () => toCamel,
  toDisplayName: () => toDisplayName,
  usePathDependency: () => usePathDependency
});
import { appendFileSync, existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync4, writeFileSync as writeFileSync2 } from "node:fs";
import { basename as basename2, isAbsolute as isAbsolute2, join as join4, relative, resolve as resolve3 } from "node:path";
var TAG, fail, toAppName, toCamel, toDisplayName, detectFramework, GITIGNORE_ENTRIES, appendGitignore, usePathDependency, runInit;
var init_init = __esm({
  "src/commands/init.ts"() {
    "use strict";
    init_package();
    init_config();
    init_shared();
    init_template();
    TAG = "init";
    fail = (message) => {
      console.error(`[${TAG}] ${message}`);
      process.exit(1);
    };
    toAppName = (raw) => {
      const cleaned = raw.replace(/^@[^/]+\//, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
      const name = /^[a-z]/.test(cleaned) ? cleaned : `app_${cleaned}`;
      return name === "app_" ? "app" : name;
    };
    toCamel = (snake) => snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    toDisplayName = (snake) => snake.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    detectFramework = (root) => {
      const has = (prefix) => ["ts", "js", "mjs", "mts"].some((ext) => existsSync4(join4(root, `${prefix}.config.${ext}`)));
      if (has("nuxt")) {
        return "nuxt";
      }
      if (has("next")) {
        return "next";
      }
      if (has("vite")) {
        return "vite";
      }
      return null;
    };
    GITIGNORE_ENTRIES = [
      "# Aqutter",
      "/artifacts/",
      ".env/.env.*",
      "!.env/.env.example"
    ];
    appendGitignore = (root, appDir) => {
      const file = join4(root, ".gitignore");
      const current = existsSync4(file) ? readFileSync4(file, "utf8") : "";
      const wanted = [
        ...GITIGNORE_ENTRIES,
        `/${appDir}/assets/seed/*`,
        `!/${appDir}/assets/seed/.gitkeep`,
        `/${appDir}/signing/signing.*.json`,
        `!/${appDir}/signing/signing.example.json`
      ];
      const missing = wanted.filter((line) => line.startsWith("#") ? !current.includes(line) : !current.split("\n").includes(line));
      if (missing.length === 0) {
        return;
      }
      appendFileSync(file, `${current === "" || current.endsWith("\n") ? "" : "\n"}
${missing.join("\n")}
`);
    };
    usePathDependency = (pubspec, shellPath) => {
      return pubspec.replace(/ {2}aqutter:\n {4}git:\n(?: {6}.*\n)+/, `  aqutter:
    path: ${shellPath}
`);
    };
    runInit = async (cwd, argv) => {
      const { flags } = parseArgs(argv.filter((arg) => arg !== "--force"));
      const force = argv.includes("--force");
      const root = resolve3(cwd);
      let packageName = basename2(root);
      const packageJson = join4(root, "package.json");
      if (existsSync4(packageJson)) {
        try {
          packageName = JSON.parse(readFileSync4(packageJson, "utf8")).name ?? packageName;
        } catch {
        }
      }
      const appName = toAppName(flags.name ?? packageName);
      const orgId = flags.org ?? "com.example";
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(orgId)) {
        fail(`--org \u9700\u70BA\u5C0F\u5BEB\u7684\u53CD\u5411\u7DB2\u57DF\uFF08\u4F8B\u5982 com.example\uFF09\uFF0C\u6536\u5230\u300C${orgId}\u300D\u3002`);
      }
      if (!/^[a-z][a-z0-9_]*$/.test(appName)) {
        fail(`--name \u9700\u70BA\u5C0F\u5BEB snake_case\uFF08Dart \u5957\u4EF6\u540D\uFF09\uFF0C\u6536\u5230\u300C${appName}\u300D\u3002`);
      }
      const framework = flags.framework ?? detectFramework(root) ?? "vite";
      if (!FRAMEWORKS.includes(framework)) {
        fail(`--framework \u9700\u70BA ${FRAMEWORKS.join(" / ")}\uFF0C\u6536\u5230\u300C${framework}\u300D\u3002`);
      }
      const appDirName = flags["app-dir"] ?? DEFAULT_CONFIG.appDir;
      const appDir = resolve3(root, appDirName);
      const shellRef = flags["shell-ref"] ?? package_default.version;
      const configFile = join4(root, CONFIG_FILE);
      if (existsSync4(configFile) && !force) {
        fail(`${CONFIG_FILE} \u5DF2\u5B58\u5728\u3002\u8981\u91CD\u65B0\u5C55\u958B\u8ACB\u52A0 --force\u3002`);
      }
      const config = {
        ...appDirName === DEFAULT_CONFIG.appDir ? {} : { appDir: appDirName },
        web: { framework }
      };
      const shellConfig = flags["shell-path"] ? { path: flags["shell-path"] } : void 0;
      writeFileSync2(configFile, `${JSON.stringify(shellConfig ? { ...config, shell: shellConfig } : config, null, 2)}
`);
      console.log(`[${TAG}] \u5BEB\u5165 ${CONFIG_FILE}\uFF08framework=${framework}\uFF09`);
      const variables = {
        appName,
        appNameCamel: toCamel(appName),
        orgId,
        orgPath: orgId.split(".").join("/"),
        displayName: flags["display-name"] ?? toDisplayName(appName),
        shellRef
      };
      const templateRoot = findTemplateRoot();
      const { written, skipped } = renderTree(join4(templateRoot, "app"), appDir, variables, { overwrite: force });
      console.log(`[${TAG}] \u5C55\u958B ${relative(root, appDir) || "."}/\uFF08${written.length} \u500B\u6A94\u6848\uFF0C\u7565\u904E\u5DF2\u5B58\u5728 ${skipped.length} \u500B\uFF09`);
      if (flags["shell-path"]) {
        const pubspecPath = join4(appDir, "pubspec.yaml");
        const shellFlag = flags["shell-path"];
        const rel = isAbsolute2(shellFlag) ? shellFlag : relative(appDir, resolve3(root, shellFlag)).split("\\").join("/");
        writeFileSync2(pubspecPath, usePathDependency(readFileSync4(pubspecPath, "utf8"), rel));
        console.log(`[${TAG}] \u6BBC\u4F9D\u8CF4\u6539\u6307\u5411\u672C\u6A5F\u8DEF\u5F91\uFF1A${rel}`);
      }
      const envDir = join4(root, DEFAULT_CONFIG.envDir);
      mkdirSync3(envDir, { recursive: true });
      const envResult = renderTree(join4(templateRoot, "env"), envDir, variables);
      if (envResult.written.length > 0) {
        console.log(`[${TAG}] \u5BEB\u5165 ${DEFAULT_CONFIG.envDir}/.env.example\uFF1B\u8ACB\u8907\u88FD\u70BA ${DEFAULT_CONFIG.envDir}/.env.dev \u4E26\u586B\u503C\u3002`);
      }
      appendGitignore(root, appDirName);
      console.log(`
[${TAG}] \u5B8C\u6210\u3002\u4E0B\u4E00\u6B65\uFF1A`);
      console.log(`  cp ${DEFAULT_CONFIG.envDir}/.env.example ${DEFAULT_CONFIG.envDir}/.env.dev`);
      console.log(`  cd ${appDirName} && flutter pub get && cd ..`);
      console.log("  aqutter dev macos");
    };
  }
});

// src/plugins.ts
import { existsSync as existsSync5, readFileSync as readFileSync5, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join5, relative as relative2 } from "node:path";
var PLUGIN_DESCRIPTOR_FILE, PLUGIN_ID_PATTERN, PUBSPEC_BEGIN, PUBSPEC_END, PLUGINS_DART_FILE, DART_PACKAGE_PATTERN, DART_CLASS_PATTERN, parseDescriptor, importOf, renderPluginsDart, renderPubspecBlock, applyPubspecBlock, syncPlugins, updateConfigPlugins, readInstalledDescriptor;
var init_plugins = __esm({
  "src/plugins.ts"() {
    "use strict";
    init_config();
    PLUGIN_DESCRIPTOR_FILE = "aqutter-plugin.json";
    PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
    PUBSPEC_BEGIN = "  # aqutter-plugins:begin\uFF08\u7531 `aqutter plugin` \u7DAD\u8B77\uFF0C\u8ACB\u52FF\u624B\u6539\uFF09";
    PUBSPEC_END = "  # aqutter-plugins:end";
    PLUGINS_DART_FILE = "aqutter_plugins.dart";
    DART_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*$/;
    DART_CLASS_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;
    parseDescriptor = (raw, source) => {
      const fail9 = (reason) => {
        throw new Error(`${source} \u4E0D\u5408\u6CD5\uFF1A${reason}`);
      };
      if (typeof raw !== "object" || raw === null) {
        return fail9("\u5FC5\u9808\u662F JSON \u7269\u4EF6");
      }
      const value = raw;
      if (value.schema !== 1) {
        fail9("schema \u5FC5\u9808\u70BA 1");
      }
      if (typeof value.id !== "string" || !PLUGIN_ID_PATTERN.test(value.id)) {
        fail9(`id \u5FC5\u9808\u7B26\u5408 ${PLUGIN_ID_PATTERN}`);
      }
      const dart = value.dart;
      if (typeof dart !== "object" || dart === null) {
        return fail9("\u7F3A\u5C11 dart \u5340\u584A");
      }
      if (typeof dart.package !== "string" || !DART_PACKAGE_PATTERN.test(dart.package)) {
        fail9("dart.package \u5FC5\u9808\u662F Dart \u5957\u4EF6\u540D\uFF08\u5C0F\u5BEB snake_case\uFF09");
      }
      if (typeof dart.class !== "string" || !DART_CLASS_PATTERN.test(dart.class)) {
        fail9("dart.class \u5FC5\u9808\u662F Dart \u985E\u5225\u540D");
      }
      if (dart.import !== void 0 && typeof dart.import !== "string") {
        fail9("dart.import \u5FC5\u9808\u662F\u5B57\u4E32");
      }
      return {
        schema: 1,
        id: value.id,
        dart: {
          package: dart.package,
          class: dart.class,
          ...dart.import === void 0 ? {} : { import: dart.import }
        }
      };
    };
    importOf = (entry) => entry.dart.import ?? `package:${entry.dart.package}/${entry.dart.package}.dart`;
    renderPluginsDart = (plugins) => {
      const imports = [...new Set(plugins.map(importOf))].sort();
      const lines = [
        "// \u7531 `aqutter plugin` \u7522\u751F\uFF0C\u8ACB\u52FF\u624B\u6539\uFF1B\u8981\u589E\u6E1B plugin \u8ACB\u7528 `aqutter plugin add/remove`\u3002",
        "// ignore_for_file: directives_ordering",
        "import 'package:aqutter/aqutter.dart';",
        ...imports.map((path) => `import '${path}';`),
        "",
        "/// \u50B3\u7D66 `runAqutter(plugins: aqutterPlugins)`\u3002",
        plugins.length === 0 ? "final List<AqutterPlugin> aqutterPlugins = <AqutterPlugin>[];" : `final List<AqutterPlugin> aqutterPlugins = <AqutterPlugin>[
${plugins.map((entry) => `  ${entry.dart.class}(),`).join("\n")}
];`,
        ""
      ];
      return lines.join("\n");
    };
    renderPubspecBlock = (plugins, projectRoot, appDir) => {
      return plugins.flatMap((entry) => {
        const path = relative2(appDir, join5(projectRoot, "node_modules", entry.npm)).split("\\").join("/");
        return [`  ${entry.dart.package}:`, `    path: ${path}`];
      });
    };
    applyPubspecBlock = (pubspec, block) => {
      const begin = pubspec.indexOf(PUBSPEC_BEGIN);
      const end = pubspec.indexOf(PUBSPEC_END);
      if (begin === -1 || end === -1 || end < begin) {
        throw new Error(`pubspec.yaml \u7F3A\u5C11 plugin \u53D7\u7BA1\u5340\u584A\u6A19\u8A18\uFF08${PUBSPEC_BEGIN.trim()} \u2026 ${PUBSPEC_END.trim()}\uFF09\uFF0C\u8ACB\u5728 dependencies: \u5167\u88DC\u4E0A\u9019\u5169\u884C\u3002`);
      }
      const middle = block.length === 0 ? "" : `${block.join("\n")}
`;
      return `${pubspec.slice(0, begin)}${PUBSPEC_BEGIN}
${middle}${pubspec.slice(end)}`;
    };
    syncPlugins = (project) => {
      const plugins = project.config.plugins;
      const pubspecPath = join5(project.appDir, "pubspec.yaml");
      const original = readFileSync5(pubspecPath, "utf8");
      const next = applyPubspecBlock(original, renderPubspecBlock(plugins, project.root, project.appDir));
      if (next !== original) {
        writeFileSync3(pubspecPath, next);
      }
      writeFileSync3(join5(project.appDir, "lib", PLUGINS_DART_FILE), renderPluginsDart(plugins));
    };
    updateConfigPlugins = (project, update) => {
      const previous = project.config.plugins;
      const next = update([...previous]);
      project.config.plugins = next;
      try {
        syncPlugins(project);
      } catch (error) {
        project.config.plugins = previous;
        throw error;
      }
      const file = join5(project.root, CONFIG_FILE);
      const raw = JSON.parse(readFileSync5(file, "utf8"));
      if (next.length === 0) {
        delete raw.plugins;
      } else {
        raw.plugins = next;
      }
      writeFileSync3(file, `${JSON.stringify(raw, null, 2)}
`);
    };
    readInstalledDescriptor = (projectRoot, npmName) => {
      const file = join5(projectRoot, "node_modules", npmName, PLUGIN_DESCRIPTOR_FILE);
      if (!existsSync5(file)) {
        throw new Error(`${npmName} \u5167\u627E\u4E0D\u5230 ${PLUGIN_DESCRIPTOR_FILE}\uFF0C\u5B83\u4E0D\u662F Aqutter plugin\u3002`);
      }
      return parseDescriptor(JSON.parse(readFileSync5(file, "utf8")), `${npmName}/${PLUGIN_DESCRIPTOR_FILE}`);
    };
  }
});

// src/commands/plugin.ts
var plugin_exports = {};
__export(plugin_exports, {
  runPlugin: () => runPlugin,
  toClassName: () => toClassName,
  toSnake: () => toSnake
});
import { spawnSync as spawnSync2 } from "node:child_process";
import { existsSync as existsSync6, readFileSync as readFileSync6, writeFileSync as writeFileSync4 } from "node:fs";
import { isAbsolute as isAbsolute3, join as join6, relative as relative3, resolve as resolve4 } from "node:path";
var TAG2, fail2, capitalize, toClassName, toSnake, detectPackageManager, runPm, readDependencyNames, create, add, remove, runPlugin;
var init_plugin = __esm({
  "src/commands/plugin.ts"() {
    "use strict";
    init_package();
    init_config();
    init_shared();
    init_template();
    init_plugins();
    init_init();
    TAG2 = "plugin";
    fail2 = (message) => {
      console.error(`[${TAG2}] ${message}`);
      process.exit(1);
    };
    capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);
    toClassName = (id) => id.split("-").map(capitalize).join("");
    toSnake = (id) => id.replace(/-/g, "_");
    detectPackageManager = (root) => {
      if (existsSync6(join6(root, "pnpm-lock.yaml"))) {
        return "pnpm";
      }
      if (existsSync6(join6(root, "yarn.lock"))) {
        return "yarn";
      }
      return "npm";
    };
    runPm = (pm, args, cwd) => {
      console.log(`[${TAG2}] ${pm} ${args.join(" ")}`);
      const result = spawnSync2(pm, args, { cwd, stdio: "inherit", shell: IS_WIN });
      if (result.status !== 0) {
        fail2(`${pm} ${args.join(" ")} \u5931\u6557\uFF08exit ${result.status ?? "signal"}\uFF09\u3002`);
      }
    };
    readDependencyNames = (root) => {
      const file = join6(root, "package.json");
      if (!existsSync6(file)) {
        return /* @__PURE__ */ new Set();
      }
      const json = JSON.parse(readFileSync6(file, "utf8"));
      return /* @__PURE__ */ new Set([...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {})]);
    };
    create = (cwd, argv) => {
      const { positional, flags } = parseArgs(argv);
      const id = positional[0];
      if (!id || !PLUGIN_ID_PATTERN.test(id)) {
        return fail2(`\u7528\u6CD5\uFF1Aaqutter plugin create <id>\uFF08id \u70BA\u5C0F\u5BEB\u5B57\u6BCD\u958B\u982D\u3001\u50C5\u542B\u5C0F\u5BEB\u5B57\u6BCD / \u6578\u5B57 / \u9023\u5B57\u865F\uFF0C\u4F8B\u5982 haptics\uFF09`);
      }
      const dirName = flags.dir ?? `aqutter-plugin-${id}`;
      const target = resolve4(cwd, dirName);
      if (existsSync6(target)) {
        return fail2(`${dirName} \u5DF2\u5B58\u5728\u3002`);
      }
      const variables = {
        id,
        idSnake: toSnake(id),
        className: toClassName(id),
        dartPackage: `aqutter_plugin_${toSnake(id)}`,
        npmName: flags["npm-name"] ?? `aqutter-plugin-${id}`,
        shellRef: flags["shell-ref"] ?? package_default.version,
        clientRef: flags["shell-ref"] ?? package_default.version
      };
      const { written } = renderTree(join6(findTemplateRoot(), "plugin"), target, variables);
      if (flags["shell-path"]) {
        const shellFlag = flags["shell-path"];
        const rel = isAbsolute3(shellFlag) ? shellFlag : relative3(target, resolve4(cwd, shellFlag)).split("\\").join("/");
        const pubspec = join6(target, "pubspec.yaml");
        writeFileSync4(pubspec, usePathDependency(readFileSync6(pubspec, "utf8"), rel));
      }
      console.log(`[${TAG2}] \u5DF2\u5EFA\u7ACB ${dirName}/\uFF08${written.length} \u500B\u6A94\u6848\uFF09`);
      console.log("\n\u4E0B\u4E00\u6B65\uFF1A");
      console.log(`  cd ${dirName} && pnpm install && flutter pub get && flutter test`);
      console.log(`  \u4E4B\u5F8C\u5728 App \u5C08\u6848\uFF1Aaqutter plugin add file:../${dirName}`);
    };
    add = (cwd, argv) => {
      const { positional } = parseArgs(argv.filter((arg) => arg !== "--no-install"));
      const source = positional[0];
      if (!source) {
        return fail2("\u7528\u6CD5\uFF1Aaqutter plugin add <\u4F86\u6E90>\uFF08\u5957\u4EF6\u540D\u3001github:owner/repo \u6216 file:\u8DEF\u5F91\uFF09");
      }
      const project = loadProject(cwd);
      const pm = detectPackageManager(project.root);
      const before = readDependencyNames(project.root);
      if (!argv.includes("--no-install")) {
        runPm(pm, pm === "npm" ? ["install", source] : ["add", source], project.root);
      }
      const after = readDependencyNames(project.root);
      const added = [...after].filter((name) => !before.has(name));
      const npmName = added[0] ?? (before.has(source) ? source : void 0);
      if (!npmName) {
        return fail2("\u7121\u6CD5\u5224\u65B7\u5B89\u88DD\u7684 npm \u5957\u4EF6\u540D\uFF1B\u8ACB\u78BA\u8A8D\u5B89\u88DD\u6210\u529F\uFF08\u6216\u5957\u4EF6\u5DF2\u5B58\u5728\u6642\uFF0C\u7528\u5957\u4EF6\u540D\u7576\u4F86\u6E90\uFF09\u3002");
      }
      const descriptor = readInstalledDescriptor(project.root, npmName);
      if (project.config.plugins.some((entry) => entry.id === descriptor.id && entry.npm !== npmName)) {
        return fail2(`plugin id\u300C${descriptor.id}\u300D\u5DF2\u88AB\u53E6\u4E00\u500B\u5957\u4EF6\u4F7F\u7528\u3002`);
      }
      updateConfigPlugins(project, (plugins) => [
        ...plugins.filter((entry) => entry.id !== descriptor.id),
        { id: descriptor.id, npm: npmName, dart: descriptor.dart }
      ].sort((a, b) => a.id.localeCompare(b.id)));
      console.log(`[${TAG2}] \u5DF2\u52A0\u5165 plugin\u300C${descriptor.id}\u300D\uFF08${npmName}\uFF09\u3002\u8ACB\u5728 ${project.config.appDir}/ \u57F7\u884C flutter pub get\u3002`);
    };
    remove = (cwd, argv) => {
      const id = argv[0];
      if (!id) {
        return fail2("\u7528\u6CD5\uFF1Aaqutter plugin remove <id>");
      }
      const project = loadProject(cwd);
      const entry = project.config.plugins.find((plugin) => plugin.id === id);
      if (!entry) {
        return fail2(`\u5C08\u6848\u5167\u6C92\u6709 plugin\u300C${id}\u300D\u3002`);
      }
      updateConfigPlugins(project, (plugins) => plugins.filter((plugin) => plugin.id !== id));
      const pm = detectPackageManager(project.root);
      runPm(pm, ["remove", entry.npm], project.root);
      console.log(`[${TAG2}] \u5DF2\u79FB\u9664 plugin\u300C${id}\u300D\u3002`);
    };
    runPlugin = async (cwd, argv) => {
      const [sub, ...rest] = argv;
      switch (sub) {
        case "create":
          return create(cwd, rest);
        case "add":
          return add(cwd, rest);
        case "remove":
          return remove(cwd, rest);
        case "sync": {
          const project = loadProject(cwd);
          syncPlugins(project);
          console.log(`[${TAG2}] \u5DF2\u540C\u6B65 ${project.config.plugins.length} \u500B plugin\u3002`);
          return;
        }
        case "list": {
          const project = loadProject(cwd);
          for (const entry of project.config.plugins) {
            console.log(`${entry.id}	${entry.npm}	${entry.dart.package}`);
          }
          return;
        }
        default:
          return fail2("\u7528\u6CD5\uFF1Aaqutter plugin <create|add|remove|sync|list>");
      }
    };
  }
});

// src/menu.ts
import { existsSync as existsSync7, readFileSync as readFileSync7, readdirSync as readdirSync3 } from "node:fs";
import { join as join7 } from "node:path";
var ENV_PREFIX, SIGNING_FILE, EXAMPLE_MARK, isExample, SIGNING_PLATFORMS, envPathOf, signingPathOf, listDir, listEnvFiles, readIfExists, listFlavors, listSigningConfigs, resolveXEnv, printOptions, chooseOne, chooseMany;
var init_menu = __esm({
  "src/menu.ts"() {
    "use strict";
    ENV_PREFIX = ".env.";
    SIGNING_FILE = /^signing\.(.+)\.json$/;
    EXAMPLE_MARK = ".example";
    isExample = (name) => name.includes(EXAMPLE_MARK);
    SIGNING_PLATFORMS = ["ios", "macos", "windows"];
    envPathOf = (project, name) => `${project.config.envDir}/${ENV_PREFIX}${name}`;
    signingPathOf = (name) => `signing/signing.${name}.json`;
    listDir = (dir) => existsSync7(dir) ? readdirSync3(dir) : [];
    listEnvFiles = (project) => {
      return listDir(join7(project.root, project.config.envDir)).filter((name) => name.startsWith(ENV_PREFIX) && !isExample(name)).sort().map((name) => ({
        path: `${project.config.envDir}/${name}`,
        name: name.slice(ENV_PREFIX.length)
      }));
    };
    readIfExists = (path) => existsSync7(path) ? readFileSync7(path, "utf8") : "";
    listFlavors = (project) => {
      const found = /* @__PURE__ */ new Map();
      const add2 = (name, platform) => {
        const platforms = found.get(name) ?? /* @__PURE__ */ new Set();
        platforms.add(platform);
        found.set(name, platforms);
      };
      const gradle = readIfExists(join7(project.appDir, "android", "app", "build.gradle.kts"));
      for (const match of gradle.matchAll(/create\("([a-z][a-z0-9]*)"\)/g)) {
        add2(match[1], "android");
      }
      for (const platform of ["ios", "macos"]) {
        const pbxproj = readIfExists(join7(project.appDir, platform, "Runner.xcodeproj", "project.pbxproj"));
        for (const match of pbxproj.matchAll(/name = "Release-([a-z][a-z0-9]*)";/g)) {
          add2(match[1], platform);
        }
      }
      return [...found.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, platforms]) => ({
        name,
        platforms: [...platforms]
      }));
    };
    listSigningConfigs = (project) => {
      const dir = join7(project.appDir, "signing");
      return listDir(dir).filter((name) => SIGNING_FILE.test(name) && !isExample(name)).sort().map((name) => {
        let platforms = [];
        try {
          platforms = Object.keys(JSON.parse(readFileSync7(join7(dir, name), "utf8"))).filter((key) => SIGNING_PLATFORMS.includes(key));
        } catch {
        }
        return {
          path: `signing/${name}`,
          name: SIGNING_FILE.exec(name)[1],
          platforms
        };
      });
    };
    resolveXEnv = (project, flags, {
      tag,
      withSigning
    }) => {
      const xEnv = flags["x-env"] ?? null;
      const envPath = flags.env ?? (xEnv ? envPathOf(project, xEnv) : null);
      let flavor = flags.flavor ?? null;
      if (flavor === null && xEnv) {
        if (listFlavors(project).some((entry) => entry.name === xEnv)) {
          flavor = xEnv;
        } else {
          console.log(`[${tag}] --x-env=${xEnv}\uFF1A\u672A\u5EFA flavor\u300C${xEnv}\u300D\uFF0C\u4E0D\u5E36 --flavor\u3002`);
        }
      }
      let signingPath = flags.signing ?? null;
      if (withSigning && signingPath === null && xEnv) {
        const candidate = signingPathOf(xEnv);
        if (existsSync7(join7(project.appDir, candidate))) {
          signingPath = candidate;
        } else {
          console.log(`[${tag}] --x-env=${xEnv}\uFF1A\u627E\u4E0D\u5230 ${candidate}\uFF0C\u4E0D\u5E36 --signing\u3002`);
        }
      }
      return {
        envPath,
        flavor,
        signingPath
      };
    };
    printOptions = (title, options) => {
      console.log(`
${title}`);
      options.forEach((option, index) => console.log(`  ${index + 1}) ${option.label}`));
    };
    chooseOne = async (prompter, title, options, defaultIndex = null) => {
      printOptions(title, options);
      const hint = defaultIndex === null ? "" : ` [${defaultIndex + 1}]`;
      for (; ; ) {
        const answer = await prompter.ask(`\u8F38\u5165\u7DE8\u865F${hint}\uFF1A`);
        if (answer === "" && defaultIndex !== null) {
          return options[defaultIndex];
        }
        const index = Number.parseInt(answer, 10) - 1;
        if (Number.isInteger(index) && index >= 0 && index < options.length) {
          return options[index];
        }
        console.log("  \u7121\u6548\u7684\u9078\u64C7\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u3002");
      }
    };
    chooseMany = async (prompter, title, options) => {
      printOptions(title, options);
      for (; ; ) {
        const answer = (await prompter.ask("\u8F38\u5165\u7DE8\u865F\uFF08\u53EF\u591A\u9078\uFF0C\u9017\u865F\u6216\u7A7A\u767D\u5206\u9694\uFF1Ball\uFF1D\u5168\u90E8\uFF09\uFF1A")).toLowerCase();
        if (answer === "all") {
          return [...options];
        }
        const tokens = answer.split(/[\s,]+/).filter(Boolean);
        const indexes = tokens.map((token) => Number.parseInt(token, 10) - 1);
        const valid = tokens.length > 0 && indexes.every((index) => Number.isInteger(index) && index >= 0 && index < options.length);
        if (valid) {
          const picked = new Set(indexes);
          return options.filter((_, index) => picked.has(index));
        }
        console.log("  \u7121\u6548\u7684\u9078\u64C7\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u3002");
      }
    };
  }
});

// src/web.ts
import { existsSync as existsSync8, readFileSync as readFileSync8 } from "node:fs";
import { join as join8 } from "node:path";
var parseEnvFile, execPrefix, withExec, envFromFile, shellInvocation, fill, nuxtAdapter, viteAdapter, nextAdapter, customAdapter, createWebAdapter;
var init_web = __esm({
  "src/web.ts"() {
    "use strict";
    init_shared();
    parseEnvFile = (path) => {
      const result = {};
      for (const rawLine of readFileSync8(path, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === "" || line.startsWith("#")) {
          continue;
        }
        const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!match) {
          continue;
        }
        let value = match[2];
        const quote = value[0];
        if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
          value = value.slice(1, -1);
        } else {
          value = value.replace(/\s+#.*$/, "");
        }
        result[match[1]] = value;
      }
      return result;
    };
    execPrefix = (project) => {
      if (existsSync8(join8(project.root, "pnpm-lock.yaml"))) {
        return { command: "pnpm", args: ["exec"] };
      }
      if (existsSync8(join8(project.root, "yarn.lock"))) {
        return { command: "yarn", args: [] };
      }
      return { command: "npx", args: ["--no-install"] };
    };
    withExec = (project, bin, args, env) => {
      const prefix = execPrefix(project);
      return { command: prefix.command, args: [...prefix.args, bin, ...args], env };
    };
    envFromFile = (project, envFile) => parseEnvFile(join8(project.root, envFile));
    shellInvocation = (command) => {
      return IS_WIN ? { command: "cmd", args: ["/c", command] } : { command: "sh", args: ["-c", command] };
    };
    fill = (template, values) => {
      return template.replace(/\{(envFile|port|host)\}/g, (_, key) => values[key] ?? "");
    };
    nuxtAdapter = (project) => ({
      outputDir: project.config.web.outputDir ?? ".output/public",
      cleanDirs: project.config.web.cleanDirs ?? [".nuxt", ".output"],
      // nuxi 需以等號綁值（`--dotenv=<file>`），否則值會被當成 rootDir 位置參數；
      // `--host` 的值是選填的、會吃掉緊接其後的參數，故必須放在最後。
      dev: ({ envFile, port, devHost }) => withExec(project, "nuxt", ["dev", `--dotenv=${envFile}`, `--port=${port}`, "--host"], {
        ...devHost ? { DEV_HOST: devHost } : {},
        // 設定檔讀不到 CLI 參數，故以 env 交棒——CSP 的 connect-src 與 HMR 的 websocket 埠都要跟著動
        DEV_PORT: String(port)
      }),
      generate: ({ envFile }) => [
        // 清掉 .nuxt 後 `nuxt generate` 不會自行補回 .nuxt/tsconfig.json，需先 prepare
        { label: "nuxt prepare", ...withExec(project, "nuxt", ["prepare"]) },
        { label: "nuxt generate", ...withExec(project, "nuxt", ["generate", `--dotenv=${envFile}`]) }
      ]
    });
    viteAdapter = (project) => ({
      outputDir: project.config.web.outputDir ?? "dist",
      cleanDirs: project.config.web.cleanDirs ?? ["dist"],
      dev: ({ envFile, port, devHost }) => withExec(project, "vite", ["--port", String(port), "--strictPort", "--host"], {
        ...envFromFile(project, envFile),
        ...devHost ? { DEV_HOST: devHost } : {},
        DEV_PORT: String(port)
      }),
      generate: ({ envFile }) => [
        { label: "vite build", ...withExec(project, "vite", ["build"], envFromFile(project, envFile)) }
      ]
    });
    nextAdapter = (project) => ({
      outputDir: project.config.web.outputDir ?? "out",
      cleanDirs: project.config.web.cleanDirs ?? [".next", "out"],
      dev: ({ envFile, port, devHost }) => withExec(project, "next", ["dev", "-p", String(port), "-H", "0.0.0.0"], {
        ...envFromFile(project, envFile),
        ...devHost ? { DEV_HOST: devHost } : {},
        DEV_PORT: String(port)
      }),
      // 需在 next.config 設 `output: 'export'`，build 才會產出 out/
      generate: ({ envFile }) => [
        { label: "next build", ...withExec(project, "next", ["build"], envFromFile(project, envFile)) }
      ]
    });
    customAdapter = (project) => {
      const custom = project.config.web.custom;
      if (!custom) {
        throw new Error("web.framework \u70BA custom \u6642\u5FC5\u9808\u8A2D\u5B9A web.custom\u3002");
      }
      const outputDir = project.config.web.outputDir;
      if (!outputDir) {
        throw new Error("web.framework \u70BA custom \u6642\u5FC5\u9808\u8A2D\u5B9A web.outputDir\u3002");
      }
      return {
        outputDir,
        cleanDirs: project.config.web.cleanDirs ?? [],
        dev: ({ envFile, port, devHost }) => ({
          ...shellInvocation(fill(custom.dev, { envFile, port: String(port), host: devHost ?? "" })),
          env: {
            ...envFromFile(project, envFile),
            ...devHost ? { DEV_HOST: devHost } : {},
            DEV_PORT: String(port)
          }
        }),
        generate: ({ envFile }) => {
          const env = envFromFile(project, envFile);
          const values = { envFile, port: "", host: "" };
          const steps = [];
          if (custom.prepare) {
            steps.push({ label: "prepare", ...shellInvocation(fill(custom.prepare, values)), env });
          }
          steps.push({ label: "generate", ...shellInvocation(fill(custom.generate, values)), env });
          return steps;
        }
      };
    };
    createWebAdapter = (project) => {
      switch (project.config.web.framework) {
        case "nuxt":
          return nuxtAdapter(project);
        case "vite":
          return viteAdapter(project);
        case "next":
          return nextAdapter(project);
        case "custom":
          return customAdapter(project);
      }
    };
  }
});

// src/commands/dev.ts
var dev_exports = {};
__export(dev_exports, {
  runDev: () => runDev
});
import { spawn, spawnSync as spawnSync3 } from "node:child_process";
import { existsSync as existsSync9 } from "node:fs";
import { networkInterfaces } from "node:os";
import { join as join9 } from "node:path";
var TAG3, fail3, sleep, isIos, isAndroid, DESKTOP_PLATFORMS, isDesktop, deviceKind, findAdb, lanIp, DESKTOP_TARGETS, runDev;
var init_dev = __esm({
  "src/commands/dev.ts"() {
    "use strict";
    init_shared();
    init_menu();
    init_web();
    TAG3 = "flutter:dev";
    fail3 = (message) => {
      console.error(`[${TAG3}] ${message}`);
      process.exit(1);
    };
    sleep = (ms) => new Promise((resolve5) => setTimeout(resolve5, ms));
    isIos = (device) => device.targetPlatform?.startsWith("ios") ?? false;
    isAndroid = (device) => device.targetPlatform?.startsWith("android") ?? false;
    DESKTOP_PLATFORMS = /* @__PURE__ */ new Set(["darwin", "windows-x64", "linux-x64"]);
    isDesktop = (device) => DESKTOP_PLATFORMS.has(device.targetPlatform ?? "");
    deviceKind = (device) => {
      if (isDesktop(device)) {
        return "desktop";
      }
      if (isAndroid(device)) {
        return "android";
      }
      if (isIos(device)) {
        return device.emulator ? "sim" : "ios-device";
      }
      return "other";
    };
    findAdb = () => {
      const candidates = [
        join9(process.env.HOME ?? "", "Library/Android/sdk/platform-tools/adb"),
        join9(process.env.HOME ?? "", "Android/Sdk/platform-tools/adb")
      ];
      return candidates.find((path) => existsSync9(path)) ?? "adb";
    };
    lanIp = () => {
      for (const infos of Object.values(networkInterfaces())) {
        for (const info of infos ?? []) {
          if (info.family === "IPv4" && !info.internal) {
            return info.address;
          }
        }
      }
      return null;
    };
    DESKTOP_TARGETS = /* @__PURE__ */ new Set(["macos", "windows", "linux"]);
    runDev = async (project, argv) => {
      const appDir = project.appDir;
      const config = project.config;
      const listDevices = () => {
        const result = spawnSync3("flutter", ["devices", "--machine"], {
          cwd: appDir,
          encoding: "utf8",
          shell: IS_WIN
        });
        try {
          return JSON.parse(result.stdout);
        } catch {
          return [];
        }
      };
      const listEmulators = () => {
        const output = spawnSync3("flutter", ["emulators"], {
          cwd: appDir,
          encoding: "utf8",
          shell: IS_WIN
        }).stdout ?? "";
        return output.split("\n").filter((line) => line.includes("\u2022")).map((line) => line.split("\u2022").map((col) => col.trim())).map((cols) => ({
          id: cols[0],
          platform: cols[cols.length - 1]?.toLowerCase()
        })).filter((emu) => emu.id && emu.id.toLowerCase() !== "id");
      };
      const runningAndroidAvdNames = () => {
        const adb2 = findAdb();
        const names = [];
        for (const device of listDevices().filter(isAndroid)) {
          const output = spawnSync3(adb2, ["-s", device.id, "emu", "avd", "name"], { encoding: "utf8" }).stdout ?? "";
          const name = output.split("\n")[0]?.trim();
          if (name) {
            names.push(name);
          }
        }
        return names;
      };
      const bootableAndroidEmulators = () => {
        const running = new Set(runningAndroidAvdNames());
        return listEmulators().filter((emu) => emu.platform === "android" && !running.has(emu.id)).map((emu) => ({
          label: `${emu.id} [Android \u6A21\u64EC\u5668\xB7\u53EF\u958B\u6A5F]`,
          kind: "android",
          boot: {
            type: "emu",
            id: emu.id
          }
        }));
      };
      const bootableIosSimulators = () => {
        const output = spawnSync3("xcrun", ["simctl", "list", "devices", "available", "--json"], { encoding: "utf8" }).stdout ?? "";
        let data;
        try {
          data = JSON.parse(output);
        } catch {
          return [];
        }
        const sims = [];
        for (const [runtime, devices] of Object.entries(data.devices ?? {})) {
          if (!runtime.includes("iOS")) {
            continue;
          }
          const version = (runtime.split(".").pop() ?? "").replace("iOS-", "iOS ").replace(/-/g, ".");
          for (const device of devices) {
            if (device.state !== "Booted" && device.isAvailable !== false) {
              sims.push({
                label: `${device.name} \xB7 ${version} [iOS \u6A21\u64EC\u5668\xB7\u53EF\u958B\u6A5F]`,
                kind: "sim",
                boot: {
                  type: "sim",
                  udid: device.udid
                }
              });
            }
          }
        }
        return sims;
      };
      const runningTargets = (scope) => {
        return listDevices().filter((device) => device.id !== "chrome" && device.targetPlatform !== "web-javascript").filter((device) => {
          if (scope === "ios") {
            return isIos(device);
          }
          if (scope === "android") {
            return isAndroid(device);
          }
          return true;
        }).map((device) => {
          const kind = deviceKind(device);
          const tag = kind === "desktop" ? "\u684C\u9762" : device.emulator ? "\u6A21\u64EC\u5668" : "\u5BE6\u6A5F";
          return {
            label: `${device.name} (${device.id}) [${tag}\xB7\u57F7\u884C\u4E2D]`,
            deviceId: device.id,
            kind,
            boot: null
          };
        });
      };
      const buildOptions = (scope) => {
        const options = runningTargets(scope);
        if (scope === "all" || scope === "ios") {
          options.push(...bootableIosSimulators());
        }
        if (scope === "all" || scope === "android") {
          options.push(...bootableAndroidEmulators());
        }
        return options;
      };
      let prompter = null;
      const getPrompter = () => {
        prompter ??= createPrompter({
          onClose: () => fail3("\u8F38\u5165\u5DF2\u7D50\u675F\uFF0C\u672A\u555F\u52D5\u4EFB\u4F55\u7A0B\u5E8F\u3002")
        });
        return prompter;
      };
      const closePrompter = () => {
        prompter?.close();
        prompter = null;
      };
      const promptChoice = (options) => chooseOne(getPrompter(), "\u8ACB\u9078\u64C7\u76EE\u6A19\u88DD\u7F6E\uFF1A", options);
      const promptEnvAndFlavor = async (preset2) => {
        let envPath2 = preset2.envPath;
        if (envPath2 === null) {
          const envFiles = listEnvFiles(project);
          if (envFiles.length === 0) {
            envPath2 = config.defaultDevEnv;
          } else {
            const defaultIndex = Math.max(0, envFiles.findIndex((env) => env.path === config.defaultDevEnv));
            envPath2 = (await chooseOne(
              getPrompter(),
              "\u8ACB\u9078\u64C7 env \u6A94\uFF1A",
              envFiles.map((env) => ({
                label: `${env.name.padEnd(12)}${env.path}`,
                path: env.path
              })),
              defaultIndex
            )).path;
          }
        }
        let flavor2 = preset2.flavor;
        if (flavor2 === null) {
          const flavors = listFlavors(project);
          if (flavors.length > 0) {
            flavor2 = (await chooseOne(
              getPrompter(),
              "\u8ACB\u9078\u64C7 flavor\uFF1A",
              [
                {
                  label: "\uFF08\u4E0D\u7528 flavor\uFF09",
                  name: null
                },
                ...flavors.map((entry) => ({
                  label: `${entry.name.padEnd(12)}\u5DF2\u5EFA\u65BC ${entry.platforms.join(" / ")}`,
                  name: entry.name
                }))
              ],
              0
            )).name;
          }
        }
        return {
          envPath: envPath2,
          flavor: flavor2
        };
      };
      const waitForDevice = async (predicate) => {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const device = listDevices().find(predicate);
          if (device) {
            return device;
          }
          await sleep(4e3);
        }
        return null;
      };
      const ensureBooted = async (choice) => {
        const boot = choice.boot;
        if (!boot) {
          return choice.deviceId;
        }
        if (boot.type === "sim") {
          console.log(`[${TAG3}] \u958B\u6A5F iOS \u6A21\u64EC\u5668\u2026`);
          spawnSync3("xcrun", ["simctl", "boot", boot.udid], { stdio: "inherit" });
          spawnSync3("open", ["-a", "Simulator"], { stdio: "ignore" });
          const device2 = await waitForDevice((d) => d.id === boot.udid);
          if (!device2) {
            return fail3("iOS \u6A21\u64EC\u5668\u555F\u52D5\u903E\u6642\u3002");
          }
          return device2.id;
        }
        console.log(`[${TAG3}] \u555F\u52D5 Android \u6A21\u64EC\u5668 ${boot.id}\u2026`);
        spawnSync3("flutter", ["emulators", "--launch", boot.id], {
          cwd: appDir,
          stdio: "inherit",
          shell: IS_WIN
        });
        const device = await waitForDevice(isAndroid);
        if (!device) {
          return fail3("Android \u6A21\u64EC\u5668\u555F\u52D5\u903E\u6642\u3002");
        }
        return device.id;
      };
      const pickInteractive = async (scope) => {
        const options = buildOptions(scope);
        if (options.length === 0) {
          fail3(`\u627E\u4E0D\u5230 ${scope} \u76EE\u6A19\u88DD\u7F6E\uFF08\u53EF\u5148\u555F\u52D5\u6A21\u64EC\u5668\u6216\u9023\u4E0A\u5BE6\u6A5F\uFF09\u3002`);
        }
        const choice = options.length === 1 ? options[0] : await promptChoice(options);
        const deviceId = await ensureBooted(choice);
        return {
          deviceId,
          kind: choice.kind
        };
      };
      const resolveTarget = async (target2) => {
        if (DESKTOP_TARGETS.has(target2)) {
          return {
            deviceId: target2,
            kind: "desktop"
          };
        }
        if (target2 === "ios-device") {
          const device2 = listDevices().find((d) => isIos(d) && !d.emulator);
          if (!device2) {
            return fail3("\u627E\u4E0D\u5230\u5DF2\u9023\u63A5\u7684 iOS \u5BE6\u6A5F\uFF08\u5BE6\u6A5F\u7121\u6CD5\u81EA\u52D5\u555F\u52D5\uFF0C\u8ACB\u63D2\u4E0A\u4E26\u89E3\u9396\uFF09\u3002");
          }
          return {
            deviceId: device2.id,
            kind: "ios-device"
          };
        }
        if (target2 === "pick" || target2 === "all") {
          return pickInteractive("all");
        }
        if (target2 === "ios") {
          return pickInteractive("ios");
        }
        if (target2 === "android" || target2 === "android-device") {
          return pickInteractive("android");
        }
        const device = listDevices().find((d) => d.id === target2);
        if (!device) {
          return fail3(`\u672A\u77E5 target\u300C${target2}\u300D\uFF0C\u4E14\u975E\u57F7\u884C\u4E2D\u7684 device id\u3002\u53EF\u7528\uFF1A\u7701\u7565(\u4E92\u52D5) / ios / android / macos / windows / linux / ios-device / <device id>\u3002`);
        }
        return {
          deviceId: device.id,
          kind: deviceKind(device)
        };
      };
      const setupConnectivity = ({ deviceId, kind, port: port2 }) => {
        if (kind === "android") {
          const adb2 = findAdb();
          spawnSync3(adb2, ["-s", deviceId, "reverse", `tcp:${port2}`, `tcp:${port2}`], { stdio: "inherit" });
          return {
            devUrl: `http://localhost:${port2}`,
            devHost: null,
            adb: adb2
          };
        }
        if (kind === "ios-device") {
          const ip = lanIp();
          if (!ip) {
            fail3("\u7121\u6CD5\u5075\u6E2C\u958B\u767C\u6A5F\u5340\u7DB2 IP\uFF08iOS \u5BE6\u6A5F dev \u9700\u8981\uFF09\u3002\u8ACB\u78BA\u8A8D\u5DF2\u9023\u4E0A\u7DB2\u8DEF\u3002");
          }
          return {
            devUrl: `http://${ip}:${port2}`,
            devHost: ip,
            adb: null
          };
        }
        return {
          devUrl: `http://localhost:${port2}`,
          devHost: null,
          adb: null
        };
      };
      const { positional, flags } = parseArgs(argv);
      const target = positional[0] ?? "pick";
      const preset = resolveXEnv(project, flags, {
        tag: TAG3,
        withSigning: false
      });
      const { envPath, flavor } = target === "pick" ? await promptEnvAndFlavor(preset) : {
        envPath: preset.envPath ?? config.defaultDevEnv,
        flavor: preset.flavor
        // Flutter flavor（對應 iOS scheme + Android productFlavor）
      };
      const port = resolvePort(project, flags);
      if (port === null) {
        return fail3(`--port \u9700\u70BA 1-65535 \u7684\u6574\u6578\uFF0C\u6536\u5230\u300C${flags.port}\u300D\u3002`);
      }
      if (positional.length > 1) {
        console.warn(`[${TAG3}] \u5FFD\u7565\u591A\u9918\u4F4D\u7F6E\u53C3\u6578\uFF1A${positional.slice(1).join(" ")}\uFF08\u74B0\u5883\u8ACB\u7528 --env=<env \u6A94\u8DEF\u5F91>\uFF09`);
      }
      const envFile = resolveEnvFile(project, envPath);
      if (!envFile) {
        return fail3(describeMissingEnv(project, envPath));
      }
      const resolved = await resolveTarget(target);
      closePrompter();
      const { devUrl, devHost, adb } = setupConnectivity({
        ...resolved,
        port
      });
      console.log(
        `[${TAG3}] device=${resolved.deviceId} kind=${resolved.kind} env=${envFile}${flavor ? ` flavor=${flavor}` : ""} AQUTTER_DEV_URL=${devUrl}${devHost ? ` DEV_HOST=${devHost}` : ""}`
      );
      const children = [];
      let shuttingDown = false;
      const terminate = (child) => {
        if (!IS_WIN) {
          child.kill("SIGTERM");
          return;
        }
        if (!child.pid) {
          return;
        }
        spawnSync3("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      };
      const shutdown = (code) => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;
        if (adb) {
          spawnSync3(adb, ["-s", resolved.deviceId, "reverse", "--remove", `tcp:${port}`], { stdio: "ignore" });
        }
        for (const child of children) {
          try {
            terminate(child);
          } catch {
          }
        }
        process.exit(code);
      };
      const run = (command, args, options) => {
        const child = spawn(command, args, {
          stdio: "inherit",
          shell: IS_WIN,
          ...options
        });
        children.push(child);
        child.on("exit", (code) => shutdown(code ?? 0));
        return child;
      };
      process.on("SIGINT", () => shutdown(0));
      process.on("SIGTERM", () => shutdown(0));
      const web = createWebAdapter(project);
      const devServer = web.dev({
        envFile,
        port,
        devHost: devHost ?? void 0
      });
      run(devServer.command, devServer.args, {
        cwd: project.root,
        env: {
          ...process.env,
          ...devServer.env
        }
      });
      ensureSeedDir(project);
      const flutterArgs = [
        "run",
        "-d",
        resolved.deviceId,
        "--dart-define-from-file",
        join9(project.root, envFile),
        "--dart-define",
        `AQUTTER_DEV_URL=${devUrl}`
      ];
      if (flavor) {
        flutterArgs.push("--flavor", flavor);
      }
      if (resolved.kind === "android") {
        flutterArgs.push("--enable-hcpp");
      }
      run("flutter", flutterArgs, { cwd: appDir });
    };
  }
});

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i = 0; i < str.length; ++i)
      ar_1[i] = str.charCodeAt(i);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i = 0; i < l; ++i) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i = 0; i < files.length; ++i) {
    var f = files[i];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
var require2, _a, Worker, isMarkedAsUntransferable, u8, u16, i32, fleb, fdeb, clim, freb, _a, fl, revfl, _b, fd, revfd, rev, x, i, hMap, flt, i, i, i, i, fdt, i, flm, fdm, shft, slc, ec, err, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, deo, et, dflt, crct, crc, dopt, mrg, wbytes, fltn, te, td, tds, exfl, wzh, wzf;
var init_esm = __esm({
  "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs"() {
    require2 = createRequire("/");
    try {
      _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
    } catch (e) {
    }
    u8 = Uint8Array;
    u16 = Uint16Array;
    i32 = Int32Array;
    fleb = new u8([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      4,
      5,
      5,
      5,
      5,
      0,
      /* unused */
      0,
      0,
      /* impossible */
      0
    ]);
    fdeb = new u8([
      0,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
      7,
      7,
      8,
      8,
      9,
      9,
      10,
      10,
      11,
      11,
      12,
      12,
      13,
      13,
      /* unused */
      0,
      0
    ]);
    clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    freb = function(eb, start) {
      var b = new u16(31);
      for (var i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
      }
      var r = new i32(b[30]);
      for (var i = 1; i < 30; ++i) {
        for (var j = b[i]; j < b[i + 1]; ++j) {
          r[j] = j - b[i] << 5 | i;
        }
      }
      return { b, r };
    };
    _a = freb(fleb, 2);
    fl = _a.b;
    revfl = _a.r;
    fl[28] = 258, revfl[258] = 28;
    _b = freb(fdeb, 0);
    fd = _b.b;
    revfd = _b.r;
    rev = new u16(32768);
    for (i = 0; i < 32768; ++i) {
      x = (i & 43690) >> 1 | (i & 21845) << 1;
      x = (x & 52428) >> 2 | (x & 13107) << 2;
      x = (x & 61680) >> 4 | (x & 3855) << 4;
      rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
    }
    hMap = (function(cd, mb, r) {
      var s = cd.length;
      var i = 0;
      var l = new u16(mb);
      for (; i < s; ++i) {
        if (cd[i])
          ++l[cd[i] - 1];
      }
      var le = new u16(mb);
      for (i = 1; i < mb; ++i) {
        le[i] = le[i - 1] + l[i - 1] << 1;
      }
      var co;
      if (r) {
        co = new u16(1 << mb);
        var rvb = 15 - mb;
        for (i = 0; i < s; ++i) {
          if (cd[i]) {
            var sv = i << 4 | cd[i];
            var r_1 = mb - cd[i];
            var v = le[cd[i] - 1]++ << r_1;
            for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
              co[rev[v] >> rvb] = sv;
            }
          }
        }
      } else {
        co = new u16(s);
        for (i = 0; i < s; ++i) {
          if (cd[i]) {
            co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
          }
        }
      }
      return co;
    });
    flt = new u8(288);
    for (i = 0; i < 144; ++i)
      flt[i] = 8;
    for (i = 144; i < 256; ++i)
      flt[i] = 9;
    for (i = 256; i < 280; ++i)
      flt[i] = 7;
    for (i = 280; i < 288; ++i)
      flt[i] = 8;
    fdt = new u8(32);
    for (i = 0; i < 32; ++i)
      fdt[i] = 5;
    flm = /* @__PURE__ */ hMap(flt, 9, 0);
    fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
    shft = function(p) {
      return (p + 7) / 8 | 0;
    };
    slc = function(v, s, e) {
      if (s == null || s < 0)
        s = 0;
      if (e == null || e > v.length)
        e = v.length;
      return new u8(v.subarray(s, e));
    };
    ec = [
      "unexpected EOF",
      "invalid block type",
      "invalid length/literal",
      "invalid distance",
      "stream finished",
      "no stream handler",
      ,
      // determined by compression function
      "no callback",
      "invalid UTF-8 data",
      "extra field too long",
      "date not in range 1980-2099",
      "filename too long",
      "stream finishing",
      "invalid zip data"
      // determined by unknown compression method
    ];
    err = function(ind, msg, nt) {
      var e = new Error(msg || ec[ind]);
      e.code = ind;
      if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
      if (!nt)
        throw e;
      return e;
    };
    wbits = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
    };
    wbits16 = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
      d[o + 2] |= v >> 16;
    };
    hTree = function(d, mb) {
      var t = [];
      for (var i = 0; i < d.length; ++i) {
        if (d[i])
          t.push({ s: i, f: d[i] });
      }
      var s = t.length;
      var t2 = t.slice();
      if (!s)
        return { t: et, l: 0 };
      if (s == 1) {
        var v = new u8(t[0].s + 1);
        v[t[0].s] = 1;
        return { t: v, l: 1 };
      }
      t.sort(function(a, b) {
        return a.f - b.f;
      });
      t.push({ s: -1, f: 25001 });
      var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
      t[0] = { s: -1, f: l.f + r.f, l, r };
      while (i1 != s - 1) {
        l = t[t[i0].f < t[i2].f ? i0++ : i2++];
        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
        t[i1++] = { s: -1, f: l.f + r.f, l, r };
      }
      var maxSym = t2[0].s;
      for (var i = 1; i < s; ++i) {
        if (t2[i].s > maxSym)
          maxSym = t2[i].s;
      }
      var tr = new u16(maxSym + 1);
      var mbt = ln(t[i1 - 1], tr, 0);
      if (mbt > mb) {
        var i = 0, dt = 0;
        var lft = mbt - mb, cst = 1 << lft;
        t2.sort(function(a, b) {
          return tr[b.s] - tr[a.s] || a.f - b.f;
        });
        for (; i < s; ++i) {
          var i2_1 = t2[i].s;
          if (tr[i2_1] > mb) {
            dt += cst - (1 << mbt - tr[i2_1]);
            tr[i2_1] = mb;
          } else
            break;
        }
        dt >>= lft;
        while (dt > 0) {
          var i2_2 = t2[i].s;
          if (tr[i2_2] < mb)
            dt -= 1 << mb - tr[i2_2]++ - 1;
          else
            ++i;
        }
        for (; i >= 0 && dt; --i) {
          var i2_3 = t2[i].s;
          if (tr[i2_3] == mb) {
            --tr[i2_3];
            ++dt;
          }
        }
        mbt = mb;
      }
      return { t: new u8(tr), l: mbt };
    };
    ln = function(n, l, d) {
      return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
    };
    lc = function(c) {
      var s = c.length;
      while (s && !c[--s])
        ;
      var cl = new u16(++s);
      var cli = 0, cln = c[0], cls = 1;
      var w = function(v) {
        cl[cli++] = v;
      };
      for (var i = 1; i <= s; ++i) {
        if (c[i] == cln && i != s)
          ++cls;
        else {
          if (!cln && cls > 2) {
            for (; cls > 138; cls -= 138)
              w(32754);
            if (cls > 2) {
              w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
              cls = 0;
            }
          } else if (cls > 3) {
            w(cln), --cls;
            for (; cls > 6; cls -= 6)
              w(8304);
            if (cls > 2)
              w(cls - 3 << 5 | 8208), cls = 0;
          }
          while (cls--)
            w(cln);
          cls = 1;
          cln = c[i];
        }
      }
      return { c: cl.subarray(0, cli), n: s };
    };
    clen = function(cf, cl) {
      var l = 0;
      for (var i = 0; i < cl.length; ++i)
        l += cf[i] * cl[i];
      return l;
    };
    wfblk = function(out, pos, dat) {
      var s = dat.length;
      var o = shft(pos + 2);
      out[o] = s & 255;
      out[o + 1] = s >> 8;
      out[o + 2] = out[o] ^ 255;
      out[o + 3] = out[o + 1] ^ 255;
      for (var i = 0; i < s; ++i)
        out[o + i + 4] = dat[i];
      return (o + 4 + s) * 8;
    };
    wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
      wbits(out, p++, final);
      ++lf[256];
      var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
      var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
      var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
      var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
      var lcfreq = new u16(19);
      for (var i = 0; i < lclt.length; ++i)
        ++lcfreq[lclt[i] & 31];
      for (var i = 0; i < lcdt.length; ++i)
        ++lcfreq[lcdt[i] & 31];
      var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
      var nlcc = 19;
      for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
        ;
      var flen = bl + 5 << 3;
      var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
      var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
      if (bs >= 0 && flen <= ftlen && flen <= dtlen)
        return wfblk(out, p, dat.subarray(bs, bs + bl));
      var lm, ll, dm, dl;
      wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
      if (dtlen < ftlen) {
        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
        var llm = hMap(lct, mlcb, 0);
        wbits(out, p, nlc - 257);
        wbits(out, p + 5, ndc - 1);
        wbits(out, p + 10, nlcc - 4);
        p += 14;
        for (var i = 0; i < nlcc; ++i)
          wbits(out, p + 3 * i, lct[clim[i]]);
        p += 3 * nlcc;
        var lcts = [lclt, lcdt];
        for (var it = 0; it < 2; ++it) {
          var clct = lcts[it];
          for (var i = 0; i < clct.length; ++i) {
            var len = clct[i] & 31;
            wbits(out, p, llm[len]), p += lct[len];
            if (len > 15)
              wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
          }
        }
      } else {
        lm = flm, ll = flt, dm = fdm, dl = fdt;
      }
      for (var i = 0; i < li; ++i) {
        var sym = syms[i];
        if (sym > 255) {
          var len = sym >> 18 & 31;
          wbits16(out, p, lm[len + 257]), p += ll[len + 257];
          if (len > 7)
            wbits(out, p, sym >> 23 & 31), p += fleb[len];
          var dst = sym & 31;
          wbits16(out, p, dm[dst]), p += dl[dst];
          if (dst > 3)
            wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
        } else {
          wbits16(out, p, lm[sym]), p += ll[sym];
        }
      }
      wbits16(out, p, lm[256]);
      return p + ll[256];
    };
    deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
    et = /* @__PURE__ */ new u8(0);
    dflt = function(dat, lvl, plvl, pre, post, st) {
      var s = st.z || dat.length;
      var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
      var w = o.subarray(pre, o.length - post);
      var lst = st.l;
      var pos = (st.r || 0) & 7;
      if (lvl) {
        if (pos)
          w[0] = st.r >> 3;
        var opt = deo[lvl - 1];
        var n = opt >> 13, c = opt & 8191;
        var msk_1 = (1 << plvl) - 1;
        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
        var hsh = function(i2) {
          return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
        };
        var syms = new i32(25e3);
        var lf = new u16(288), df = new u16(32);
        var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
        for (; i + 2 < s; ++i) {
          var hv = hsh(i);
          var imod = i & 32767, pimod = head[hv];
          prev[imod] = pimod;
          head[hv] = imod;
          if (wi <= i) {
            var rem = s - i;
            if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
              pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
              li = lc_1 = eb = 0, bs = i;
              for (var j = 0; j < 286; ++j)
                lf[j] = 0;
              for (var j = 0; j < 30; ++j)
                df[j] = 0;
            }
            var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
            if (rem > 2 && hv == hsh(i - dif)) {
              var maxn = Math.min(n, rem) - 1;
              var maxd = Math.min(32767, i);
              var ml = Math.min(258, rem);
              while (dif <= maxd && --ch_1 && imod != pimod) {
                if (dat[i + l] == dat[i + l - dif]) {
                  var nl = 0;
                  for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                    ;
                  if (nl > l) {
                    l = nl, d = dif;
                    if (nl > maxn)
                      break;
                    var mmd = Math.min(dif, nl - 2);
                    var md = 0;
                    for (var j = 0; j < mmd; ++j) {
                      var ti = i - dif + j & 32767;
                      var pti = prev[ti];
                      var cd = ti - pti & 32767;
                      if (cd > md)
                        md = cd, pimod = ti;
                    }
                  }
                }
                imod = pimod, pimod = prev[imod];
                dif += imod - pimod & 32767;
              }
            }
            if (d) {
              syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
              var lin = revfl[l] & 31, din = revfd[d] & 31;
              eb += fleb[lin] + fdeb[din];
              ++lf[257 + lin];
              ++df[din];
              wi = i + l;
              ++lc_1;
            } else {
              syms[li++] = dat[i];
              ++lf[dat[i]];
            }
          }
        }
        for (i = Math.max(i, wi); i < s; ++i) {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
        if (!lst) {
          st.r = pos & 7 | w[pos / 8 | 0] << 3;
          pos -= 7;
          st.h = head, st.p = prev, st.i = i, st.w = wi;
        }
      } else {
        for (var i = st.w || 0; i < s + lst; i += 65535) {
          var e = i + 65535;
          if (e >= s) {
            w[pos / 8 | 0] = lst;
            e = s;
          }
          pos = wfblk(w, pos + 1, dat.subarray(i, e));
        }
        st.i = s;
      }
      return slc(o, 0, pre + shft(pos) + post);
    };
    crct = /* @__PURE__ */ (function() {
      var t = new Int32Array(256);
      for (var i = 0; i < 256; ++i) {
        var c = i, k = 9;
        while (--k)
          c = (c & 1 && -306674912) ^ c >>> 1;
        t[i] = c;
      }
      return t;
    })();
    crc = function() {
      var c = -1;
      return {
        p: function(d) {
          var cr = c;
          for (var i = 0; i < d.length; ++i)
            cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
          c = cr;
        },
        d: function() {
          return ~c;
        }
      };
    };
    dopt = function(dat, opt, pre, post, st) {
      if (!st) {
        st = { l: 1 };
        if (opt.dictionary) {
          var dict = opt.dictionary.subarray(-32768);
          var newDat = new u8(dict.length + dat.length);
          newDat.set(dict);
          newDat.set(dat, dict.length);
          dat = newDat;
          st.w = dict.length;
        }
      }
      return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
    };
    mrg = function(a, b) {
      var o = {};
      for (var k in a)
        o[k] = a[k];
      for (var k in b)
        o[k] = b[k];
      return o;
    };
    wbytes = function(d, b, v) {
      for (; v; ++b)
        d[b] = v, v >>>= 8;
    };
    fltn = function(d, p, t, o) {
      for (var k in d) {
        var val = d[k], n = p + k, op = o;
        if (Array.isArray(val))
          op = mrg(o, val[1]), val = val[0];
        if (ArrayBuffer.isView(val))
          t[n] = [val, op];
        else {
          t[n += "/"] = [new u8(0), op];
          fltn(val, n, t, o);
        }
      }
    };
    te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
    td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
    tds = 0;
    try {
      td.decode(et, { stream: true });
      tds = 1;
    } catch (e) {
    }
    exfl = function(ex) {
      var le = 0;
      if (ex) {
        for (var k in ex) {
          var l = ex[k].length;
          if (l > 65535)
            err(9);
          le += l + 4;
        }
      }
      return le;
    };
    wzh = function(d, b, f, fn, u, c, ce, co) {
      var fl2 = fn.length, ex = f.extra, col = co && co.length;
      var exl = exfl(ex);
      wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
      if (ce != null)
        d[b++] = 20, d[b++] = f.os;
      d[b] = 20, b += 2;
      d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
      d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
      var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
      if (y < 0 || y > 119)
        err(10);
      wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
      if (c != -1) {
        wbytes(d, b, f.crc);
        wbytes(d, b + 4, c < 0 ? -c - 2 : c);
        wbytes(d, b + 8, f.size);
      }
      wbytes(d, b + 12, fl2);
      wbytes(d, b + 14, exl), b += 16;
      if (ce != null) {
        wbytes(d, b, col);
        wbytes(d, b + 6, f.attrs);
        wbytes(d, b + 10, ce), b += 14;
      }
      d.set(fn, b);
      b += fl2;
      if (exl) {
        for (var k in ex) {
          var exf = ex[k], l = exf.length;
          wbytes(d, b, +k);
          wbytes(d, b + 2, l);
          d.set(exf, b + 4), b += 4 + l;
        }
      }
      if (col)
        d.set(co, b), b += col;
      return b;
    };
    wzf = function(o, b, c, d, e) {
      wbytes(o, b, 101010256);
      wbytes(o, b + 8, c);
      wbytes(o, b + 10, c);
      wbytes(o, b + 12, d);
      wbytes(o, b + 16, e);
    };
  }
});

// src/syncSeed.ts
import { readFileSync as readFileSync9, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join10, relative as relative4 } from "node:path";
var VERSION_ENTRY, FONT_EXTENSIONS, assertNoFonts, buildVersion, packSeed;
var init_syncSeed = __esm({
  "src/syncSeed.ts"() {
    "use strict";
    init_esm();
    init_shared();
    VERSION_ENTRY = "version.json";
    FONT_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"];
    assertNoFonts = (entryNames) => {
      const fonts = entryNames.filter((name) => FONT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)));
      if (fonts.length === 0) {
        return;
      }
      throw new Error(
        `[syncSeed] \u7DB2\u9801\u5305\u5167\u4E0D\u61C9\u51FA\u73FE\u5B57\u578B\u6A94\uFF08\u5B57\u578B\u7531 Aqutter \u6BBC\u63D0\u4F9B\uFF0C\u898B /_flutter/fonts/\uFF09\uFF1A
  ${fonts.join("\n  ")}`
      );
    };
    buildVersion = (now = /* @__PURE__ */ new Date()) => {
      const pad = (value) => String(value).padStart(2, "0");
      return [
        pad(now.getUTCFullYear() % 100),
        pad(now.getUTCMonth() + 1),
        pad(now.getUTCDate()),
        pad(now.getUTCHours()),
        pad(now.getUTCMinutes()),
        pad(now.getUTCSeconds())
      ].join("");
    };
    packSeed = (project, sourceRelative) => {
      const sourceDir = join10(project.root, sourceRelative);
      const files = collectFiles(sourceDir);
      if (files.length === 0) {
        throw new Error(`[syncSeed] \u627E\u4E0D\u5230\u7522\u7269\uFF0C\u8ACB\u5148\u7522\u751F\u975C\u614B\u7DB2\u9801\uFF08${sourceDir} \u70BA\u7A7A\uFF09`);
      }
      const zipEntries = {};
      for (const file of files) {
        const name = relative4(sourceDir, file).split("\\").join("/");
        zipEntries[name] = new Uint8Array(readFileSync9(file));
      }
      assertNoFonts(Object.keys(zipEntries));
      const version = buildVersion();
      const versionJson = `${JSON.stringify({ version }, null, 2)}
`;
      zipEntries[VERSION_ENTRY] = new TextEncoder().encode(versionJson);
      ensureSeedDir(project);
      writeFileSync5(project.seedBundle, zipSync(zipEntries));
      writeFileSync5(project.seedVersion, versionJson);
      console.log(`[syncSeed] \u5DF2\u6253\u5305 ${Object.keys(zipEntries).length} \u500B\u6A94\u6848\uFF08\u7248\u672C ${version}\uFF09\u2192 ${project.seedBundle}`);
      return version;
    };
  }
});

// src/commands/seed.ts
var seed_exports = {};
__export(seed_exports, {
  runSeed: () => runSeed
});
import { spawnSync as spawnSync4 } from "node:child_process";
import { copyFileSync as copyFileSync2, mkdirSync as mkdirSync4, readFileSync as readFileSync10, rmSync } from "node:fs";
import { join as join11, relative as relative5 } from "node:path";
var TAG4, WEB_ARTIFACT_NAME, fail4, runSeed;
var init_seed = __esm({
  "src/commands/seed.ts"() {
    "use strict";
    init_shared();
    init_syncSeed();
    init_web();
    TAG4 = "flutter:seed";
    WEB_ARTIFACT_NAME = "web";
    fail4 = (message) => {
      console.error(`[${TAG4}] ${message}`);
      process.exit(1);
    };
    runSeed = async (project, argv) => {
      const { flags } = parseArgs(argv);
      const envPath = flags.env ?? project.config.defaultDevEnv;
      const envFile = resolveEnvFile(project, envPath);
      if (!envFile) {
        return fail4(describeMissingEnv(project, envPath));
      }
      const envName = envNameOf(envFile);
      if (!envName) {
        return fail4(`\u7121\u6CD5\u7531 env \u6A94 \`${envFile}\` \u63A8\u5C0E\u74B0\u5883\u540D\uFF08\u6A94\u540D\u9808\u70BA .env.<\u74B0\u5883> \u5F62\u5F0F\uFF0C\u4F8B\u5982 ${project.config.envDir}/.env.uat\uFF09\u3002`);
      }
      console.log(`[${TAG4}] env=${envFile}`);
      const web = createWebAdapter(project);
      if (web.cleanDirs.length > 0) {
        console.log(`[${TAG4}] clean: ${web.cleanDirs.join(" / ")}\uFF08\u907F\u514D\u6CBF\u7528\u524D\u4E00\u4EFD env \u7684\u8A2D\u5B9A\u503C\uFF09`);
      }
      for (const dir of web.cleanDirs) {
        rmSync(join11(project.root, dir), {
          recursive: true,
          force: true
        });
      }
      for (const stepSpec of web.generate({ envFile })) {
        console.log(`[${TAG4}] ${stepSpec.label}: ${stepSpec.command} ${stepSpec.args.join(" ")}`);
        const result = spawnSync4(stepSpec.command, stepSpec.args, {
          cwd: project.root,
          stdio: "inherit",
          shell: IS_WIN,
          env: {
            ...process.env,
            ...stepSpec.env
          }
        });
        if (result.status !== 0) {
          fail4(`\u6B65\u9A5F\u5931\u6557\uFF1A${stepSpec.label}\uFF08exit ${result.status ?? "signal"}\uFF09\u3002`);
        }
      }
      console.log(`[${TAG4}] pack seed`);
      packSeed(project, web.outputDir);
      const { version } = JSON.parse(readFileSync10(project.seedVersion, "utf8"));
      mkdirSync4(project.artifactsDir, { recursive: true });
      const artifact = join11(project.artifactsDir, `${WEB_ARTIFACT_NAME}_${envName}_${version}.zip`);
      copyFileSync2(project.seedBundle, artifact);
      console.log(`[${TAG4}] \u5B8C\u6210\uFF08env=${envFile}\uFF09\u2192 ${relative5(project.root, artifact)}`);
    };
  }
});

// src/signing.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync5, readFileSync as readFileSync11, readdirSync as readdirSync4, writeFileSync as writeFileSync6 } from "node:fs";
import { join as join12 } from "node:path";
function signingSectionOf(config, signingPath, platformKey) {
  const section = config[platformKey];
  if (!section || typeof section !== "object") {
    return null;
  }
  const missing = REQUIRED_FIELDS[platformKey].filter((key) => !section[key]);
  if (platformKey === "windows" && !section.pfx && !section.thumbprint) {
    missing.push("pfx \u6216 thumbprint\uFF08\u4E8C\u64C7\u4E00\uFF09");
  }
  if (missing.length > 0) {
    fail5(`\u7C3D\u7AE0\u8A2D\u5B9A\u6A94 \`${signingPath}\` \u7684 \`${platformKey}\` \u5340\u584A\u7F3A\u6B04\u4F4D\uFF1A${missing.join("\u3001")}\u3002`);
  }
  return section;
}
var TAG5, fail5, step, REQUIRED_FIELDS, DEFAULT_TIMESTAMP_URL, iosPaths, readSigningConfig, xmlEscape, renderExportOptions, archiveAndExportIpa, signMacosApp, signWindowsExe;
var init_signing = __esm({
  "src/signing.ts"() {
    "use strict";
    init_shared();
    TAG5 = "sign";
    fail5 = (message) => {
      console.error(`[${TAG5}] ${message}`);
      process.exit(1);
    };
    step = createStep(TAG5);
    REQUIRED_FIELDS = {
      ios: ["method", "teamId", "certificate", "profile", "bundleId"],
      macos: ["identity"],
      windows: []
    };
    DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";
    iosPaths = (project) => {
      const buildDir = join12(project.appDir, "build", "ios");
      return {
        buildDir,
        archive: join12(buildDir, "archive", "Runner.xcarchive"),
        exportDir: join12(buildDir, "ipa"),
        exportOptions: join12(buildDir, "ExportOptions.plist")
      };
    };
    readSigningConfig = (project, signingPath) => {
      const file = join12(project.appDir, signingPath);
      if (!existsSync10(file)) {
        return fail5(`\u627E\u4E0D\u5230\u7C3D\u7AE0\u8A2D\u5B9A\u6A94 \`${signingPath}\`\uFF08\`--signing=\` \u5403\u7684\u662F\u76F8\u5C0D ${project.config.appDir}/ \u7684\u8DEF\u5F91\uFF0C\u7BC4\u672C\u898B ${project.config.appDir}/signing/signing.example.json\uFF09\u3002`);
      }
      try {
        return JSON.parse(readFileSync11(file, "utf8"));
      } catch (error) {
        return fail5(`\u7C3D\u7AE0\u8A2D\u5B9A\u6A94 \`${signingPath}\` \u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${error.message}`);
      }
    };
    xmlEscape = (value) => {
      return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    renderExportOptions = (ios) => {
      return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>method</key>
  <string>${xmlEscape(ios.method)}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>${xmlEscape(ios.teamId)}</string>
  <key>signingCertificate</key>
  <string>${xmlEscape(ios.certificate)}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${xmlEscape(ios.bundleId)}</key>
    <string>${xmlEscape(ios.profile)}</string>
  </dict>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
`;
    };
    archiveAndExportIpa = (project, ios, {
      flavor,
      exportOptionsPath
    }) => {
      const paths = iosPaths(project);
      const scheme = flavor ?? "Runner";
      const configuration = flavor ? `Release-${flavor}` : "Release";
      step("xcodebuild archive", "xcodebuild", [
        "-workspace",
        join12(project.appDir, "ios", "Runner.xcworkspace"),
        "-scheme",
        scheme,
        "-configuration",
        configuration,
        "-archivePath",
        paths.archive,
        "archive",
        "CODE_SIGN_STYLE=Manual",
        `DEVELOPMENT_TEAM=${ios.teamId}`,
        `PROVISIONING_PROFILE_SPECIFIER=${ios.profile}`,
        `CODE_SIGN_IDENTITY=${ios.certificate}`
      ], project.appDir);
      let exportOptions = paths.exportOptions;
      if (exportOptionsPath) {
        exportOptions = join12(project.appDir, exportOptionsPath);
      } else {
        mkdirSync5(paths.buildDir, { recursive: true });
        writeFileSync6(exportOptions, renderExportOptions(ios));
        console.log(`[${TAG5}] \u5DF2\u7531\u7C3D\u7AE0\u8A2D\u5B9A\u7522\u751F ${exportOptions}`);
      }
      step("xcodebuild -exportArchive", "xcodebuild", [
        "-exportArchive",
        "-archivePath",
        paths.archive,
        "-exportOptionsPlist",
        exportOptions,
        "-exportPath",
        paths.exportDir
      ], project.appDir);
    };
    signMacosApp = (project, macos, appPath) => {
      step("codesign", "codesign", [
        "--force",
        "--deep",
        "--options",
        "runtime",
        "--timestamp",
        "--entitlements",
        join12(project.appDir, "macos", "Runner", "Release.entitlements"),
        "--sign",
        macos.identity,
        appPath
      ], project.appDir);
      if (!macos.notaryProfile) {
        return;
      }
      const notaryZip = `${appPath}.notary.zip`;
      step("ditto\uFF08\u516C\u8B49\u7528 zip\uFF09", "ditto", ["-c", "-k", "--keepParent", appPath, notaryZip], project.appDir);
      step("notarytool submit", "xcrun", ["notarytool", "submit", notaryZip, "--keychain-profile", macos.notaryProfile, "--wait"], project.appDir);
      step("stapler staple", "xcrun", ["stapler", "staple", appPath], project.appDir);
    };
    signWindowsExe = (project, windows, releaseDir) => {
      const executables = readdirSync4(releaseDir).filter((name) => name.toLowerCase().endsWith(".exe"));
      if (executables.length === 0) {
        fail5(`Release \u76EE\u9304\u6C92\u6709\u53EF\u7C3D\u7684 .exe\uFF1A${releaseDir}`);
      }
      const certificateArgs = [];
      if (windows.pfx) {
        const password = process.env.WIN_PFX_PASSWORD;
        if (!password) {
          fail5("\u7C3D\u7AE0\u8A2D\u5B9A\u4F7F\u7528 pfx\uFF0C\u4F46 process env \u6C92\u6709 WIN_PFX_PASSWORD\u3002");
        }
        certificateArgs.push("/f", join12(project.appDir, windows.pfx), "/p", password);
      } else {
        certificateArgs.push("/sha1", windows.thumbprint);
      }
      const secrets = process.env.WIN_PFX_PASSWORD ? [process.env.WIN_PFX_PASSWORD] : [];
      for (const name of executables) {
        step(`signtool sign ${name}`, "signtool", [
          "sign",
          "/fd",
          "SHA256",
          "/td",
          "SHA256",
          "/tr",
          windows.timestampUrl ?? DEFAULT_TIMESTAMP_URL,
          ...certificateArgs,
          join12(releaseDir, name)
        ], project.appDir, secrets);
      }
    };
  }
});

// src/commands/build.ts
var build_exports = {};
__export(build_exports, {
  BuildError: () => BuildError,
  FLUTTER_TARGET: () => FLUTTER_TARGET,
  HOST_PLATFORMS: () => HOST_PLATFORMS,
  PLATFORM_LABEL: () => PLATFORM_LABEL,
  SIGNING_SECTION: () => SIGNING_SECTION,
  artifactStem: () => artifactStem,
  locateProduct: () => locateProduct,
  runBuild: () => runBuild
});
import { copyFileSync as copyFileSync3, existsSync as existsSync11, mkdirSync as mkdirSync6, readFileSync as readFileSync12, readdirSync as readdirSync5, readlinkSync, writeFileSync as writeFileSync7 } from "node:fs";
import { basename as basename3, join as join13, relative as relative6 } from "node:path";
var TAG6, FLUTTER_TARGET, fail6, BuildError, DESKTOP_ARCH, findSingle, locateProduct, artifactStem, ZIP_OS_UNIX, UNIX_MODE_SHIFT, UNIX_TYPE_FILE, UNIX_TYPE_SYMLINK, UNIX_PERMISSION_MASK, SYMLINK_PERMISSION, unixAttrs, zipEntryOf, zipDirectory, publishArtifact, step2, SIGNING_SECTION, HOST_PLATFORMS, PLATFORM_LABEL, buildOne, promptSelections, runBuild;
var init_build = __esm({
  "src/commands/build.ts"() {
    "use strict";
    init_esm();
    init_menu();
    init_shared();
    init_signing();
    init_seed();
    TAG6 = "build";
    FLUTTER_TARGET = {
      apk: "apk",
      aab: "appbundle",
      ios: "ios",
      ipa: "ipa",
      macos: "macos",
      windows: "windows",
      linux: "linux"
    };
    fail6 = (message) => {
      console.error(`[${TAG6}] ${message}`);
      process.exit(1);
    };
    BuildError = class extends Error {
      constructor(message) {
        super(`[${TAG6}] ${message}`);
        this.name = "BuildError";
      }
    };
    DESKTOP_ARCH = process.arch === "arm64" ? "arm64" : "x64";
    findSingle = (dir, extension) => {
      if (!existsSync11(dir)) {
        return null;
      }
      const matches = readdirSync5(dir).filter((entry) => entry.endsWith(extension));
      return matches.length === 1 ? join13(dir, matches[0]) : null;
    };
    locateProduct = (project, target, flavorName) => {
      const buildDir = join13(project.appDir, "build");
      switch (target) {
        case "apk": {
          const file = join13(buildDir, "app", "outputs", "flutter-apk", flavorName ? `app-${flavorName}-release.apk` : "app-release.apk");
          return {
            kind: "file",
            path: existsSync11(file) ? file : null,
            expected: file
          };
        }
        case "aab": {
          const file = flavorName ? join13(buildDir, "app", "outputs", "bundle", `${flavorName}Release`, `app-${flavorName}-release.aab`) : join13(buildDir, "app", "outputs", "bundle", "release", "app-release.aab");
          return {
            kind: "file",
            path: existsSync11(file) ? file : null,
            expected: file
          };
        }
        case "ipa": {
          const dir = join13(buildDir, "ios", "ipa");
          return {
            kind: "file",
            path: findSingle(dir, ".ipa"),
            expected: join13(dir, "*.ipa")
          };
        }
        case "ios": {
          const dir = join13(buildDir, "ios", "iphoneos", "Runner.app");
          return {
            kind: "dir",
            path: existsSync11(dir) ? dir : null,
            expected: dir
          };
        }
        case "macos": {
          const dir = join13(buildDir, "macos", "Build", "Products", flavorName ? `Release-${flavorName}` : "Release");
          return {
            kind: "dir",
            path: findSingle(dir, ".app"),
            expected: join13(dir, "*.app")
          };
        }
        case "windows": {
          const dir = join13(buildDir, "windows", DESKTOP_ARCH, ...flavorName ? [flavorName] : [], "runner", "Release");
          return {
            kind: "dir",
            path: existsSync11(dir) ? dir : null,
            expected: dir
          };
        }
        case "linux": {
          const dir = join13(buildDir, "linux", DESKTOP_ARCH, ...flavorName ? [flavorName] : [], "release", "bundle");
          return {
            kind: "dir",
            path: existsSync11(dir) ? dir : null,
            expected: dir
          };
        }
        default:
          return {
            kind: "file",
            path: null,
            expected: `(\u672A\u77E5\u5E73\u53F0 ${target})`
          };
      }
    };
    artifactStem = (name, envName, flavorName, version) => {
      return [name, envName, flavorName, version].filter(Boolean).join("_");
    };
    ZIP_OS_UNIX = 3;
    UNIX_MODE_SHIFT = 16;
    UNIX_TYPE_FILE = 32768;
    UNIX_TYPE_SYMLINK = 40960;
    UNIX_PERMISSION_MASK = 4095;
    SYMLINK_PERMISSION = 493;
    unixAttrs = (mode) => {
      return mode << UNIX_MODE_SHIFT >>> 0;
    };
    zipEntryOf = (entry) => {
      if (IS_WIN) {
        return new Uint8Array(readFileSync12(entry.path));
      }
      if (entry.kind === ENTRY_KIND.symlink) {
        return [
          new TextEncoder().encode(readlinkSync(entry.path)),
          {
            os: ZIP_OS_UNIX,
            attrs: unixAttrs(UNIX_TYPE_SYMLINK | SYMLINK_PERMISSION),
            level: 0
          }
        ];
      }
      return [
        new Uint8Array(readFileSync12(entry.path)),
        {
          os: ZIP_OS_UNIX,
          attrs: unixAttrs(UNIX_TYPE_FILE | entry.mode & UNIX_PERMISSION_MASK)
        }
      ];
    };
    zipDirectory = (dir, destination) => {
      const rootName = basename3(dir);
      const entries = {};
      for (const entry of collectEntries(dir)) {
        const name = `${rootName}/${relative6(dir, entry.path).split("\\").join("/")}`;
        entries[name] = zipEntryOf(entry);
      }
      writeFileSync7(destination, zipSync(entries));
    };
    publishArtifact = (project, target, envName, flavorName, version) => {
      const product = locateProduct(project, target, flavorName);
      if (!product.path) {
        throw new BuildError(`\u6253\u5305\u5B8C\u6210\u4F46\u627E\u4E0D\u5230\u7522\u7269\uFF1A${product.expected}`);
      }
      mkdirSync6(project.artifactsDir, { recursive: true });
      const stem = artifactStem(project.config.artifactName, envName, flavorName, version);
      if (product.kind === "file") {
        const destination2 = join13(project.artifactsDir, `${stem}.${target}`);
        copyFileSync3(product.path, destination2);
        return destination2;
      }
      const destination = join13(project.artifactsDir, `${stem}_${target}.zip`);
      zipDirectory(product.path, destination);
      return destination;
    };
    step2 = createStep(TAG6);
    SIGNING_SECTION = {
      ipa: "ios",
      macos: "macos",
      windows: "windows"
    };
    HOST_PLATFORMS = {
      darwin: ["apk", "aab", "ios", "ipa", "macos"],
      win32: ["apk", "aab", "windows"],
      linux: ["apk", "aab", "linux"]
    };
    PLATFORM_LABEL = {
      apk: "Android APK",
      aab: "Android App Bundle",
      ios: "iOS .app\uFF08\u4E0D\u7C3D\u3001\u975E\u4EA4\u4ED8\u5F62\u614B\uFF09",
      ipa: "iOS IPA",
      macos: "macOS .app",
      windows: "Windows",
      linux: "Linux"
    };
    buildOne = (project, {
      platform,
      envFile,
      envName,
      appVersion,
      flavor,
      signingPath,
      exportOptions
    }) => {
      let signing = null;
      if (signingPath) {
        const section = SIGNING_SECTION[platform];
        if (section) {
          signing = signingSectionOf(readSigningConfig(project, signingPath), signingPath, section);
        } else {
          console.warn(`[${TAG6}] \u5E73\u53F0 ${platform} \u4E0D\u5957\u7528 --signing\uFF08\u50C5 ipa / macos / windows\uFF09\uFF0C\u5DF2\u5FFD\u7565\u3002`);
        }
      }
      const signedIpa = signing !== null && platform === "ipa";
      const buildTarget = signedIpa ? "ios" : FLUTTER_TARGET[platform];
      const buildArgs = ["build", buildTarget, "--release", `--dart-define-from-file=${join13(project.root, envFile)}`];
      if (flavor) {
        buildArgs.push("--flavor", flavor);
      }
      if (signedIpa) {
        buildArgs.push("--no-codesign");
      } else if (exportOptions) {
        buildArgs.push(`--export-options-plist=${join13(project.appDir, exportOptions)}`);
      }
      step2(`flutter build ${buildTarget}`, "flutter", buildArgs, project.appDir);
      if (signedIpa) {
        archiveAndExportIpa(project, signing, {
          flavor,
          exportOptionsPath: exportOptions
        });
      } else if (signing !== null) {
        const product = locateProduct(project, platform, flavor);
        if (!product.path) {
          throw new BuildError(`\u6253\u5305\u5B8C\u6210\u4F46\u627E\u4E0D\u5230\u8981\u7C3D\u7AE0\u7684\u7522\u7269\uFF1A${product.expected}`);
        }
        if (platform === "macos") {
          signMacosApp(project, signing, product.path);
        } else {
          signWindowsExe(project, signing, product.path);
        }
      }
      return publishArtifact(project, platform, envName, flavor, appVersion);
    };
    promptSelections = async (project, preset) => {
      const prompter = createPrompter({
        onClose: () => fail6("\u8F38\u5165\u5DF2\u7D50\u675F\uFF0C\u672A\u57F7\u884C\u4EFB\u4F55\u5EFA\u7F6E\u3002")
      });
      const hostPlatforms = HOST_PLATFORMS[process.platform] ?? ["apk", "aab"];
      const platforms = (await chooseMany(
        prompter,
        `\u8ACB\u9078\u64C7\u8981\u5EFA\u7F6E\u7684\u5E73\u53F0\uFF08\u672C\u6A5F ${process.platform} \u53EF\u5EFA\uFF09\uFF1A`,
        hostPlatforms.map((platform) => ({
          label: `${platform.padEnd(8)}${PLATFORM_LABEL[platform]}`,
          platform
        }))
      )).map((option) => option.platform);
      let envPath = preset.envPath;
      if (envPath === null) {
        const envFiles = listEnvFiles(project);
        if (envFiles.length === 0) {
          fail6(`${project.config.envDir}/ \u4E0B\u6C92\u6709\u4EFB\u4F55 env \u6A94\uFF08.env.example \u9664\u5916\uFF09\uFF0C\u8ACB\u7531 ${project.config.envDir}/.env.example \u8907\u88FD\u4E00\u4EFD\u3002`);
        }
        const defaultIndex = Math.max(0, envFiles.findIndex((env) => env.path === project.config.defaultProdEnv));
        envPath = (await chooseOne(
          prompter,
          "\u8ACB\u9078\u64C7 env \u6A94\uFF1A",
          envFiles.map((env) => ({
            label: `${env.name.padEnd(12)}${env.path}`,
            path: env.path
          })),
          defaultIndex
        )).path;
      }
      let flavor = preset.flavor;
      if (flavor === null) {
        const flavors = listFlavors(project);
        if (flavors.length > 0) {
          flavor = (await chooseOne(
            prompter,
            "\u8ACB\u9078\u64C7 flavor\uFF1A",
            [
              {
                label: "\uFF08\u4E0D\u7528 flavor\uFF09",
                name: null
              },
              ...flavors.map((entry) => ({
                label: `${entry.name.padEnd(12)}\u5DF2\u5EFA\u65BC ${entry.platforms.join(" / ")}`,
                name: entry.name
              }))
            ],
            0
          )).name;
        }
      }
      let signingPath = preset.signingPath;
      const signable = platforms.some((platform) => SIGNING_SECTION[platform]);
      if (signingPath === null && signable) {
        const configs = listSigningConfigs(project);
        if (configs.length > 0) {
          signingPath = (await chooseOne(
            prompter,
            "\u8ACB\u9078\u64C7\u7C3D\u7AE0\u8A2D\u5B9A\u6A94\uFF08ipa / macos / windows \u9069\u7528\uFF09\uFF1A",
            [
              {
                label: "\uFF08\u4E0D\u7C3D\u7AE0\uFF09",
                path: null
              },
              ...configs.map((entry) => ({
                label: `${entry.path.padEnd(28)}\u6DB5\u84CB ${entry.platforms.join(" / ") || "\uFF08\u7121\u5E73\u53F0\u5340\u584A\uFF09"}`,
                path: entry.path
              }))
            ],
            0
          )).path;
        }
      }
      console.log("\n\u5C07\u4F9D\u5E8F\u5EFA\u7F6E\uFF1A");
      console.log(`  \u5E73\u53F0   : ${platforms.join(", ")}`);
      console.log(`  env    : ${envPath}`);
      console.log(`  flavor : ${flavor ?? "\uFF08\u7121\uFF09"}`);
      console.log(`  \u7C3D\u7AE0   : ${signingPath ?? "\uFF08\u7121\uFF09"}`);
      if (!await prompter.askYesNo("\u78BA\u8A8D\u958B\u59CB\uFF1F")) {
        fail6("\u5DF2\u53D6\u6D88\uFF0C\u672A\u57F7\u884C\u4EFB\u4F55\u5EFA\u7F6E\u3002");
      }
      prompter.close();
      return {
        platforms,
        envPath,
        flavor,
        signingPath
      };
    };
    runBuild = async (project, argv) => {
      const {
        positional,
        flags
      } = parseArgs(argv);
      const exportOptions = flags["export-options"] ?? null;
      const requested = [...new Set(positional.flatMap((arg) => arg.split(",")).filter(Boolean))];
      const unknown = requested.filter((platform) => !FLUTTER_TARGET[platform]);
      if (unknown.length > 0) {
        fail6(`\u672A\u77E5\u5E73\u53F0\u300C${unknown.join("\u300D\u300C")}\u300D\uFF1A${Object.keys(FLUTTER_TARGET).join(" | ")}\uFF08\u7701\u7565\u5373\u9032\u4E92\u52D5\u9078\u55AE\uFF09\u3002`);
      }
      const preset = resolveXEnv(project, flags, {
        tag: TAG6,
        withSigning: true
      });
      const selection = requested.length > 0 ? {
        platforms: requested,
        envPath: preset.envPath ?? project.config.defaultProdEnv,
        // 環境一律用 --env=<env 檔路徑> 或 --x-env=<name>
        flavor: preset.flavor,
        // Flutter flavor（iOS scheme + Android productFlavor）
        signingPath: preset.signingPath
        // 簽章設定檔（相對 App 目錄）；見 signing.ts
      } : await promptSelections(project, preset);
      const {
        platforms,
        envPath,
        flavor,
        signingPath
      } = selection;
      const envFile = resolveEnvFile(project, envPath);
      if (!envFile) {
        return fail6(describeMissingEnv(project, envPath));
      }
      const envName = envNameOf(envFile);
      if (!envName) {
        return fail6(`\u7121\u6CD5\u7531 env \u6A94 \`${envFile}\` \u63A8\u5C0E\u74B0\u5883\u540D\uFF08\u6A94\u540D\u9808\u70BA .env.<\u74B0\u5883> \u5F62\u5F0F\uFF0C\u4F8B\u5982 ${project.config.envDir}/.env.uat\uFF09\u3002`);
      }
      const appVersion = readAppVersion(project);
      if (!appVersion) {
        return fail6(`${project.config.appDir}/pubspec.yaml \u627E\u4E0D\u5230 \`version:\`\uFF0C\u7121\u6CD5\u7D44\u51FA\u7522\u7269\u6A94\u540D\u3002`);
      }
      console.log(
        `[${TAG6}] platform=${platforms.join(",")} env=${envFile}${flavor ? ` flavor=${flavor}` : ""}${exportOptions ? ` export-options=${exportOptions}` : ""}${signingPath ? ` signing=${signingPath}` : ""}`
      );
      if (signingPath) {
        const signable = platforms.filter((entry) => SIGNING_SECTION[entry]);
        const config = readSigningConfig(project, signingPath);
        const unsigned = signable.filter((platform) => signingSectionOf(config, signingPath, SIGNING_SECTION[platform]) === null);
        for (const platform of unsigned) {
          console.warn(`[${TAG6}] \u7C3D\u7AE0\u8A2D\u5B9A\u6A94 \`${signingPath}\` \u6C92\u6709 \`${SIGNING_SECTION[platform]}\` \u5340\u584A\uFF0C\u5E73\u53F0 ${platform} \u4E0D\u7C3D\u7AE0\u3002`);
        }
        if (signable.length > 0 && unsigned.length === signable.length) {
          fail6(`\u7C3D\u7AE0\u8A2D\u5B9A\u6A94 \`${signingPath}\` \u6C92\u6709\u4EFB\u4F55\u9078\u5230\u5E73\u53F0\u7684\u5340\u584A\uFF08${signable.map((platform) => SIGNING_SECTION[platform]).join(" / ")}\uFF09\u3002`);
        }
      }
      try {
        await runSeed(project, [`--env=${envFile}`]);
      } catch (error) {
        if (error instanceof StepFailure) {
          process.exit(1);
        }
        throw error;
      }
      const results = [];
      for (const platform of platforms) {
        console.log(`
[${TAG6}] ===== ${platform} =====`);
        try {
          const artifact = buildOne(project, {
            platform,
            envFile,
            envName,
            appVersion,
            flavor,
            signingPath,
            exportOptions
          });
          results.push({
            platform,
            artifact: relative6(project.root, artifact)
          });
        } catch (error) {
          if (!(error instanceof StepFailure) && !(error instanceof BuildError)) {
            throw error;
          }
          console.error(error.message);
          results.push({
            platform,
            error: error.message
          });
        }
      }
      const failed = results.filter((result) => result.error);
      if (platforms.length === 1 && failed.length === 0) {
        console.log(`
[${TAG6}] \u5B8C\u6210\uFF1A${platforms[0]}\uFF08env=${envFile}${flavor ? `, flavor=${flavor}` : ""}\uFF09\u2192 ${results[0].artifact}`);
        return;
      }
      console.log(`
[${TAG6}] \u7D50\u679C\uFF08env=${envFile}${flavor ? `, flavor=${flavor}` : ""}\uFF09\uFF1A`);
      for (const result of results) {
        console.log(result.error ? `  \u274C ${result.platform.padEnd(8)}${result.error}` : `  \u2705 ${result.platform.padEnd(8)}${result.artifact}`);
      }
      if (failed.length > 0) {
        process.exit(1);
      }
    };
  }
});

// src/commands/flavorAdd.ts
var flavorAdd_exports = {};
__export(flavorAdd_exports, {
  FLAVOR_NAME_PATTERN: () => FLAVOR_NAME_PATTERN,
  FlavorAddError: () => FlavorAddError,
  addGradleFlavor: () => addGradleFlavor,
  addXcodeConfigurations: () => addXcodeConfigurations,
  listBuildConfigurations: () => listBuildConfigurations,
  newPbxId: () => newPbxId,
  pbxName: () => pbxName,
  readAndroidApplicationId: () => readAndroidApplicationId,
  readAndroidLabel: () => readAndroidLabel,
  readBuildSetting: () => readBuildSetting,
  readPlistDisplayName: () => readPlistDisplayName,
  readXcodeIdentity: () => readXcodeIdentity,
  renderGradleFlavor: () => renderGradleFlavor,
  renderXcodeScheme: () => renderXcodeScheme,
  runFlavorAdd: () => runFlavorAdd,
  runnerConfigurationIds: () => runnerConfigurationIds,
  setBuildSetting: () => setBuildSetting,
  wireAndroidLabel: () => wireAndroidLabel,
  wireDisplayName: () => wireDisplayName
});
import { randomBytes } from "node:crypto";
import { existsSync as existsSync12, readFileSync as readFileSync13, writeFileSync as writeFileSync8 } from "node:fs";
import { join as join14, relative as relative7 } from "node:path";
var TAG7, FlavorAddError, fail7, FLAVOR_NAME_PATTERN, XCODE_MODES, GRADLE_DIMENSION, ANDROID_LABEL_RESOURCE, PBX_ID_BYTES, PBX_INDENT, BUILD_SETTING_INDENT, PLIST_INDENT, GRADLE_FILE_LABEL, kotlinEscape, pbxEscape, readAndroidApplicationId, readAndroidLabel, wireAndroidLabel, renderGradleFlavor, addGradleFlavor, newPbxId, PBX_BARE_NAME, pbxName, listBuildConfigurations, readBuildSetting, setBuildSetting, runnerConfigurationIds, readXcodeIdentity, readPlistDisplayName, wireDisplayName, addXcodeConfigurations, renderXcodeScheme, PLATFORMS, createPaths, askFlavorName, runFlavorAdd;
var init_flavorAdd = __esm({
  "src/commands/flavorAdd.ts"() {
    "use strict";
    init_shared();
    TAG7 = "flavor add";
    FlavorAddError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "FlavorAddError";
      }
    };
    fail7 = (message) => {
      console.error(`[${TAG7}] ${message}`);
      process.exit(1);
    };
    FLAVOR_NAME_PATTERN = /^[a-z][a-z0-9]*$/;
    XCODE_MODES = ["Debug", "Release", "Profile"];
    GRADLE_DIMENSION = "env";
    ANDROID_LABEL_RESOURCE = "@string/app_name";
    PBX_ID_BYTES = 12;
    PBX_INDENT = "		";
    BUILD_SETTING_INDENT = "				";
    PLIST_INDENT = "	";
    GRADLE_FILE_LABEL = "android/app/build.gradle.kts";
    kotlinEscape = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    pbxEscape = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    readAndroidApplicationId = (gradle) => {
      const match = /^\s*applicationId\s*=\s*"([^"]+)"/m.exec(gradle);
      return match ? match[1] : null;
    };
    readAndroidLabel = (manifest) => {
      const match = /<application[^>]*\sandroid:label="([^"]*)"/s.exec(manifest);
      if (!match || match[1].startsWith("@")) {
        return null;
      }
      return match[1];
    };
    wireAndroidLabel = (gradle, manifest, gradleFile = GRADLE_FILE_LABEL) => {
      const label = readAndroidLabel(manifest);
      if (label === null) {
        return {
          gradle,
          manifest,
          changed: false
        };
      }
      const wiredManifest = manifest.replace(
        /(<application[^>]*\sandroid:label=")[^"]*(")/s,
        `$1${ANDROID_LABEL_RESOURCE}$2`
      );
      let wiredGradle = gradle;
      if (!/resValues\s*=\s*true/.test(wiredGradle)) {
        const before = wiredGradle;
        wiredGradle = wiredGradle.replace(
          /\n {4}buildTypes \{/,
          "\n    buildFeatures {\n        resValues = true\n    }\n\n    buildTypes {"
        );
        if (wiredGradle === before) {
          throw new FlavorAddError(`\u5728 ${gradleFile} \u627E\u4E0D\u5230 buildTypes { \u2026 }\uFF0C\u7121\u6CD5\u63D2\u5165 buildFeatures\u3002`);
        }
      }
      if (!/resValue\("string",\s*"app_name"/.test(wiredGradle)) {
        const before = wiredGradle;
        wiredGradle = wiredGradle.replace(
          /(\n {4}defaultConfig \{\n[\s\S]*?)(\n {4}\})/,
          `$1
        resValue("string", "app_name", "${kotlinEscape(label)}")$2`
        );
        if (wiredGradle === before) {
          throw new FlavorAddError(`\u5728 ${gradleFile} \u627E\u4E0D\u5230 defaultConfig { \u2026 } \u5340\u584A\uFF0C\u7121\u6CD5\u63A5\u7DDA app_name\u3002`);
        }
      }
      return {
        gradle: wiredGradle,
        manifest: wiredManifest,
        changed: true
      };
    };
    renderGradleFlavor = ({
      name,
      applicationId,
      displayName
    }) => `        create("${name}") {
            dimension = "${GRADLE_DIMENSION}"
            applicationId = "${kotlinEscape(applicationId)}"
            resValue("string", "app_name", "${kotlinEscape(displayName)}")
        }
`;
    addGradleFlavor = (gradle, flavor, gradleFile = GRADLE_FILE_LABEL) => {
      if (new RegExp(`create\\("${flavor.name}"\\)`).test(gradle)) {
        throw new FlavorAddError(`Android \u5DF2\u6709 flavor "${flavor.name}"\uFF08${gradleFile}\uFF09\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002`);
      }
      const block = renderGradleFlavor(flavor);
      if (/\n {4}productFlavors \{/.test(gradle)) {
        const updated = gradle.replace(/(\n {4}productFlavors \{\n[\s\S]*?)(\n {4}\})/, `$1
${block.trimEnd()}$2`);
        if (updated === gradle) {
          throw new FlavorAddError(`\u5728 ${gradleFile} \u627E\u5230 productFlavors \u4F46\u89E3\u6790\u4E0D\u51FA\u5340\u584A\u7D50\u5C3E\u3002`);
        }
        return updated;
      }
      const inserted = gradle.replace(
        /\n {4}buildTypes \{/,
        `
    flavorDimensions += "${GRADLE_DIMENSION}"
    productFlavors {
${block}    }

    buildTypes {`
      );
      if (inserted === gradle) {
        throw new FlavorAddError(`\u5728 ${gradleFile} \u627E\u4E0D\u5230 buildTypes { \u2026 }\uFF0C\u7121\u6CD5\u6C7A\u5B9A productFlavors \u7684\u63D2\u5165\u9EDE\u3002`);
      }
      return inserted;
    };
    newPbxId = (pbxproj) => {
      for (; ; ) {
        const id = randomBytes(PBX_ID_BYTES).toString("hex").toUpperCase();
        if (!pbxproj.includes(id)) {
          return id;
        }
      }
    };
    PBX_BARE_NAME = /^[A-Za-z0-9_.]+$/;
    pbxName = (name) => {
      return PBX_BARE_NAME.test(name) ? name : `"${pbxEscape(name)}"`;
    };
    listBuildConfigurations = (pbxproj) => {
      const begin = pbxproj.indexOf("/* Begin XCBuildConfiguration section */");
      const end = pbxproj.indexOf("/* End XCBuildConfiguration section */");
      if (begin < 0 || end < 0) {
        throw new FlavorAddError("pbxproj \u7F3A\u5C11 XCBuildConfiguration \u5340\u6BB5\u3002");
      }
      const section = pbxproj.slice(begin, end);
      const pattern = /^\t\t([0-9A-F]{24}) \/\* (.+?) \*\/ = \{\n[\s\S]*?\n\t\t\};\n/gm;
      const blocks = [];
      for (const match of section.matchAll(pattern)) {
        blocks.push({
          id: match[1],
          name: match[2],
          text: match[0]
        });
      }
      return blocks;
    };
    readBuildSetting = (blockText, key) => {
      const match = new RegExp(`^\\t\\t\\t\\t${key} = (.*);$`, "m").exec(blockText);
      if (!match) {
        return null;
      }
      const raw = match[1];
      return raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(.)/g, "$1") : raw;
    };
    setBuildSetting = (blockText, key, value) => {
      const line = `${BUILD_SETTING_INDENT}${key} = ${value};`;
      const existing = new RegExp(`^\\t\\t\\t\\t${key} = .*;$`, "m");
      if (existing.test(blockText)) {
        return blockText.replace(existing, line);
      }
      const lines = blockText.split("\n");
      const start = lines.findIndex((entry) => entry === "			buildSettings = {");
      if (start < 0) {
        throw new FlavorAddError("pbxproj \u7684 XCBuildConfiguration \u5340\u584A\u7F3A buildSettings\u3002");
      }
      let insertAt = lines.findIndex((entry, index) => index > start && entry === "			};");
      for (let index = start + 1; index < insertAt; index += 1) {
        const match = /^\t\t\t\t([A-Z_][A-Z0-9_]*) = /.exec(lines[index]);
        if (match && match[1] > key) {
          insertAt = index;
          break;
        }
      }
      lines.splice(insertAt, 0, line);
      return lines.join("\n");
    };
    runnerConfigurationIds = (pbxproj) => {
      const match = /\/\* Build configuration list for PBXNativeTarget "Runner" \*\/ = \{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = \(\n([\s\S]*?)\t\t\t\);/.exec(pbxproj);
      if (!match) {
        throw new FlavorAddError('pbxproj \u627E\u4E0D\u5230 PBXNativeTarget "Runner" \u7684 configuration list\u3002');
      }
      return new Set([...match[1].matchAll(/^\t\t\t\t([0-9A-F]{24}) /gm)].map((entry) => entry[1]));
    };
    readXcodeIdentity = (pbxproj, appInfoXcconfig) => {
      const runnerIds = runnerConfigurationIds(pbxproj);
      const release = listBuildConfigurations(pbxproj).find((block) => block.name === "Release" && runnerIds.has(block.id));
      if (!release) {
        throw new FlavorAddError("pbxproj \u627E\u4E0D\u5230 Runner target \u7684 Release configuration\u3002");
      }
      let bundleId = readBuildSetting(release.text, "PRODUCT_BUNDLE_IDENTIFIER");
      if (bundleId === null && appInfoXcconfig !== null) {
        const match = /^PRODUCT_BUNDLE_IDENTIFIER = (.+)$/m.exec(appInfoXcconfig);
        bundleId = match ? match[1].trim() : null;
      }
      return {
        bundleId,
        displayName: readBuildSetting(release.text, "APP_DISPLAY_NAME")
      };
    };
    readPlistDisplayName = (plist) => {
      const match = /<key>CFBundleDisplayName<\/key>\n\t<string>([^<]*)<\/string>/.exec(plist);
      return match ? match[1] : null;
    };
    wireDisplayName = (pbxproj, plist, fallbackDisplayName) => {
      const current = readPlistDisplayName(plist);
      if (current === "$(APP_DISPLAY_NAME)") {
        return {
          pbxproj,
          plist,
          changed: false
        };
      }
      const original = current ?? fallbackDisplayName;
      const entry = `${PLIST_INDENT}<key>CFBundleDisplayName</key>
${PLIST_INDENT}<string>$(APP_DISPLAY_NAME)</string>`;
      const wiredPlist = current === null ? plist.replace(
        /(\t<key>CFBundleDevelopmentRegion<\/key>\n\t<string>[^<]*<\/string>\n)/,
        (_whole, region) => `${region}${entry}
`
      ) : plist.replace(
        /\t<key>CFBundleDisplayName<\/key>\n\t<string>[^<]*<\/string>/,
        () => entry
      );
      if (wiredPlist === plist) {
        throw new FlavorAddError("Info.plist \u627E\u4E0D\u5230\u53EF\u63A5\u7DDA CFBundleDisplayName \u7684\u4F4D\u7F6E\u3002");
      }
      let wiredPbxproj = pbxproj;
      const runnerIds = runnerConfigurationIds(pbxproj);
      for (const block of listBuildConfigurations(pbxproj)) {
        if (!XCODE_MODES.includes(block.name) || !runnerIds.has(block.id)) {
          continue;
        }
        if (readBuildSetting(block.text, "APP_DISPLAY_NAME") !== null) {
          continue;
        }
        const wiredBlock = setBuildSetting(block.text, "APP_DISPLAY_NAME", `"${pbxEscape(original)}"`);
        wiredPbxproj = wiredPbxproj.replace(block.text, () => wiredBlock);
      }
      return {
        pbxproj: wiredPbxproj,
        plist: wiredPlist,
        changed: true
      };
    };
    addXcodeConfigurations = (pbxproj, flavor, generateId = newPbxId) => {
      const blocks = listBuildConfigurations(pbxproj);
      if (blocks.some((block) => block.name === `Release-${flavor.name}`)) {
        throw new FlavorAddError(`Xcode \u5C08\u6848\u5DF2\u6709 configuration "Release-${flavor.name}"\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002`);
      }
      const sources = blocks.filter((block) => XCODE_MODES.includes(block.name));
      if (sources.length === 0) {
        throw new FlavorAddError("pbxproj \u627E\u4E0D\u5230 Debug / Release / Profile configuration\u3002");
      }
      let updated = pbxproj;
      const runnerIds = runnerConfigurationIds(pbxproj);
      const clones = /* @__PURE__ */ new Map();
      let appended = "";
      for (const source of sources) {
        const name = `${source.name}-${flavor.name}`;
        const id = generateId(updated + appended);
        let text = source.text.replace(`${PBX_INDENT}${source.id} /* ${source.name} */ = {`, `${PBX_INDENT}${id} /* ${name} */ = {`).replace(/^\t\t\tname = .*;$/m, `			name = ${pbxName(name)};`);
        if (runnerIds.has(source.id)) {
          text = setBuildSetting(text, "PRODUCT_BUNDLE_IDENTIFIER", flavor.bundleId);
          text = setBuildSetting(text, "APP_DISPLAY_NAME", `"${pbxEscape(flavor.displayName)}"`);
        }
        appended += text;
        clones.set(source.id, {
          id,
          name
        });
      }
      updated = updated.replace("/* End XCBuildConfiguration section */", () => `${appended}/* End XCBuildConfiguration section */`);
      updated = updated.replace(
        /(\t\t\tbuildConfigurations = \(\n)([\s\S]*?)(\t\t\t\);)/g,
        (_whole, open, body, close) => {
          const additions = [...body.matchAll(/^\t\t\t\t([0-9A-F]{24}) \/\* .+? \*\/,$/gm)].map((match) => clones.get(match[1])).filter((clone) => clone !== void 0).map((clone) => `				${clone.id} /* ${clone.name} */,
`).join("");
          return `${open}${body}${additions}${close}`;
        }
      );
      return updated;
    };
    renderXcodeScheme = (template, name) => {
      return template.replace(
        /buildConfiguration = "(Debug|Release|Profile)"/g,
        `buildConfiguration = "$1-${name}"`
      );
    };
    PLATFORMS = ["android", "ios", "macos"];
    createPaths = (project) => ({
      androidGradle: join14(project.appDir, "android", "app", "build.gradle.kts"),
      androidManifest: join14(project.appDir, "android", "app", "src", "main", "AndroidManifest.xml"),
      xcodeProject: (platform) => join14(project.appDir, platform, "Runner.xcodeproj", "project.pbxproj"),
      xcodeSchemeDir: (platform) => join14(project.appDir, platform, "Runner.xcodeproj", "xcshareddata", "xcschemes"),
      infoPlist: (platform) => join14(project.appDir, platform, "Runner", "Info.plist"),
      appInfoXcconfig: (platform) => join14(project.appDir, platform, "Runner", "Configs", "AppInfo.xcconfig")
    });
    askFlavorName = async (initial, askWithDefault) => {
      let name = initial ?? "";
      for (; ; ) {
        if (name === "") {
          name = await askWithDefault("flavor \u540D\u7A31\uFF08\u5C0F\u5BEB\u82F1\u6578\uFF0C\u4F8B\uFF1Auat\uFF09", "uat");
        }
        if (FLAVOR_NAME_PATTERN.test(name)) {
          return name;
        }
        console.log(`  "${name}" \u4E0D\u5408\u6CD5\uFF1A\u9808\u4EE5\u5C0F\u5BEB\u5B57\u6BCD\u958B\u982D\u3001\u53EA\u542B\u5C0F\u5BEB\u5B57\u6BCD\u8207\u6578\u5B57\uFF08\u5B83\u540C\u6642\u662F Gradle flavor \u540D\u3001Xcode scheme \u540D\u8207 <Mode>-<name> \u7684\u5F8C\u7DB4\uFF09\u3002`);
        name = "";
      }
    };
    runFlavorAdd = async (project, argv) => {
      const paths = createPaths(project);
      const appDirName = project.config.appDir;
      const rel = (path) => relative7(project.root, path);
      const readText = (path) => {
        if (!existsSync12(path)) {
          throw new FlavorAddError(`\u627E\u4E0D\u5230 ${rel(path)}\u3002`);
        }
        return readFileSync13(path, "utf8");
      };
      const readIdentity = (platform) => {
        const appInfo = paths.appInfoXcconfig(platform);
        return readXcodeIdentity(
          readText(paths.xcodeProject(platform)),
          existsSync12(appInfo) ? readFileSync13(appInfo, "utf8") : null
        );
      };
      const applyAndroid = (flavor) => {
        const gradleLabel = rel(paths.androidGradle);
        const wired = wireAndroidLabel(readText(paths.androidGradle), readText(paths.androidManifest), gradleLabel);
        const gradle = addGradleFlavor(wired.gradle, flavor, gradleLabel);
        writeFileSync8(paths.androidGradle, gradle);
        if (wired.changed) {
          writeFileSync8(paths.androidManifest, wired.manifest);
        }
        return [gradleLabel, ...wired.changed ? [rel(paths.androidManifest)] : []];
      };
      const writeXcodeScheme = (platform, flavor) => {
        const dir = paths.xcodeSchemeDir(platform);
        const template = join14(dir, "Runner.xcscheme");
        const target = join14(dir, `${flavor.name}.xcscheme`);
        if (existsSync12(target)) {
          throw new FlavorAddError(`\u5DF2\u6709 scheme ${rel(target)}\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002`);
        }
        writeFileSync8(target, renderXcodeScheme(readText(template), flavor.name));
        return rel(target);
      };
      const applyXcode = (platform, flavor, fallbackDisplayName) => {
        const projectPath = paths.xcodeProject(platform);
        const plistPath = paths.infoPlist(platform);
        const original = readText(projectPath);
        if (listBuildConfigurations(original).some((block) => block.name === `Release-${flavor.name}`)) {
          throw new FlavorAddError(`${platform} \u5DF2\u6709 configuration "Release-${flavor.name}"\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002`);
        }
        if (existsSync12(join14(paths.xcodeSchemeDir(platform), `${flavor.name}.xcscheme`))) {
          throw new FlavorAddError(`${platform} \u5DF2\u6709 scheme ${flavor.name}.xcscheme\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002`);
        }
        const wired = wireDisplayName(original, readText(plistPath), fallbackDisplayName);
        const pbxproj = addXcodeConfigurations(wired.pbxproj, flavor);
        writeFileSync8(projectPath, pbxproj);
        if (wired.changed) {
          writeFileSync8(plistPath, wired.plist);
        }
        const schemePath = writeXcodeScheme(platform, flavor);
        return [rel(projectPath), ...wired.changed ? [rel(plistPath)] : [], schemePath];
      };
      const {
        askWithDefault,
        askYesNo,
        close: closePrompter
      } = createPrompter({
        onClose: () => fail7("\u8F38\u5165\u5DF2\u7D50\u675F\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002")
      });
      try {
        const { positional } = parseArgs(argv);
        const available = {
          android: existsSync12(paths.androidGradle),
          ios: existsSync12(paths.xcodeProject("ios")),
          macos: existsSync12(paths.xcodeProject("macos"))
        };
        if (!available.android && !available.ios && !available.macos) {
          throw new FlavorAddError(`${appDirName}/ \u5167\u6C92\u6709 android/\u3001ios/ \u6216 macos/ \u539F\u751F\u5C08\u6848\uFF0C\u7121\u4E8B\u53EF\u505A\u3002`);
        }
        console.log("=== \u5EFA\u7ACB Flutter flavor\uFF08Android / iOS / macOS\uFF09===");
        console.log("Windows / Linux \u81EA Flutter 3.47 \u8D77\u5167\u5EFA flavor\uFF0C\u4E0D\u9700\u8A2D\u5B9A\u3002\n");
        const name = await askFlavorName(positional[0] ?? null, askWithDefault);
        const upper = name.toUpperCase();
        const iosIdentity = available.ios ? readIdentity("ios") : null;
        const iosPlistName = available.ios ? readPlistDisplayName(readText(paths.infoPlist("ios"))) : null;
        const baseDisplayName = iosIdentity?.displayName ?? (iosPlistName === "$(APP_DISPLAY_NAME)" ? null : iosPlistName) ?? "App";
        const displayName = await askWithDefault("\u986F\u793A\u540D\u7A31\uFF08App \u5716\u793A\u4E0B\u7684\u540D\u5B57\uFF09", `${baseDisplayName} ${upper}`);
        const platforms = [];
        for (const platform of PLATFORMS) {
          if (available[platform] && await askYesNo(`\u5957\u7528\u5230 ${platform}\uFF1F`) === false) {
            console.log(`  \u7565\u904E ${platform}\u3002`);
            continue;
          }
          if (available[platform]) {
            platforms.push(platform);
          }
        }
        if (platforms.length === 0) {
          throw new FlavorAddError("\u6C92\u6709\u9078\u64C7\u4EFB\u4F55\u5E73\u53F0\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002");
        }
        let applicationId = "";
        let bundleId = "";
        if (platforms.includes("android")) {
          const base = readAndroidApplicationId(readText(paths.androidGradle)) ?? "com.example.app";
          applicationId = await askWithDefault("Android applicationId", `${base}.${name}`);
        }
        if (platforms.includes("ios") || platforms.includes("macos")) {
          const base = iosIdentity?.bundleId ?? readIdentity("macos").bundleId ?? "com.example.app";
          bundleId = await askWithDefault("Apple bundle id\uFF08iOS / macOS \u5171\u7528\uFF09", `${base}.${name}`);
        }
        const touched = [];
        if (platforms.includes("android")) {
          touched.push(...applyAndroid({ name, displayName, applicationId }));
        }
        for (const platform of ["ios", "macos"]) {
          if (platforms.includes(platform)) {
            touched.push(...applyXcode(platform, { name, displayName, bundleId }, baseDisplayName));
          }
        }
        console.log(`
\u5B8C\u6210\uFF1Aflavor "${name}" \u5DF2\u5BEB\u5165`);
        for (const path of touched) {
          console.log(`  ${path}`);
        }
        console.log("\n\u63A5\u4E0B\u4F86\uFF1A");
        console.log(`  aqutter dev --flavor=${name}            # \u6216 aqutter build <platform> --flavor=${name}`);
        console.log(`  aqutter build ipa --flavor=${name} --signing=signing/${name}.json   # iOS/macOS manual \u7C3D\u7AE0\u7531 --signing \u5E36\u5165\uFF0C\u672C\u6307\u4EE4\u4E0D\u5BEB\u7C3D\u7AE0\u6B04\u4F4D`);
        if (platforms.includes("android")) {
          console.log("  Android release \u7684 signingConfig \u4ECD\u5F85\u63A5\u7DDA\u3002");
        }
        closePrompter();
      } catch (error) {
        if (error instanceof FlavorAddError) {
          return fail7(error.message);
        }
        throw error;
      }
    };
  }
});

// src/commands/genJks.ts
var genJks_exports = {};
__export(genJks_exports, {
  MIN_PASSWORD_LENGTH: () => MIN_PASSWORD_LENGTH,
  buildDistinguishedName: () => buildDistinguishedName,
  buildKeyProperties: () => buildKeyProperties,
  buildKeytoolArgs: () => buildKeytoolArgs,
  escapeDnValue: () => escapeDnValue,
  isValidPassword: () => isValidPassword,
  keytoolCandidates: () => keytoolCandidates,
  normalizeJksName: () => normalizeJksName,
  parseValidityYears: () => parseValidityYears,
  runGenJks: () => runGenJks
});
import { spawnSync as spawnSync5 } from "node:child_process";
import { existsSync as existsSync13, unlinkSync, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join15, relative as relative8 } from "node:path";
var TAG8, fail8, STORE_FILE_PREFIX_FROM_APP_MODULE, JKS_EXTENSION, DEFAULT_JKS_NAME, DEFAULT_ALIAS, DEFAULT_VALIDITY_YEARS, DEFAULT_LOCALITY, DEFAULT_COUNTRY, DAYS_PER_YEAR, MIN_PASSWORD_LENGTH, PASSWORD_ENV_KEY, KEY_ALGORITHM, KEY_SIZE, STORE_TYPE, KEYTOOL_BIN, keytoolCandidates, locateKeytool, isValidPassword, parseValidityYears, normalizeJksName, escapeDnValue, buildDistinguishedName, buildKeyProperties, buildKeytoolArgs, runGenJks;
var init_genJks = __esm({
  "src/commands/genJks.ts"() {
    "use strict";
    init_shared();
    TAG8 = "android:gen-jks";
    fail8 = (message) => {
      console.error(`[${TAG8}] ${message}`);
      process.exit(1);
    };
    STORE_FILE_PREFIX_FROM_APP_MODULE = "../";
    JKS_EXTENSION = ".jks";
    DEFAULT_JKS_NAME = "app-release";
    DEFAULT_ALIAS = "app";
    DEFAULT_VALIDITY_YEARS = 99;
    DEFAULT_LOCALITY = "Taipei";
    DEFAULT_COUNTRY = "TW";
    DAYS_PER_YEAR = 365;
    MIN_PASSWORD_LENGTH = 6;
    PASSWORD_ENV_KEY = "KS_PASS";
    KEY_ALGORITHM = "RSA";
    KEY_SIZE = "2048";
    STORE_TYPE = "JKS";
    KEYTOOL_BIN = IS_WIN ? "keytool.exe" : "keytool";
    keytoolCandidates = (javaHome, keytoolBin = KEYTOOL_BIN) => {
      const candidates = [keytoolBin];
      if (javaHome) {
        candidates.push(join15(javaHome, "bin", keytoolBin));
      }
      return candidates;
    };
    locateKeytool = () => {
      return keytoolCandidates(process.env.JAVA_HOME).find((candidate) => {
        const probe = spawnSync5(candidate, ["-help"], { stdio: "ignore" });
        return probe.error === void 0;
      }) ?? null;
    };
    isValidPassword = (password) => password.length >= MIN_PASSWORD_LENGTH;
    parseValidityYears = (answer) => {
      const years = Number(answer);
      return Number.isInteger(years) && years > 0 ? years : null;
    };
    normalizeJksName = (name) => {
      return name.toLowerCase().endsWith(JKS_EXTENSION) ? name : `${name}${JKS_EXTENSION}`;
    };
    escapeDnValue = (value) => {
      return value.replace(/([,+"\\<>;])/g, "\\$1");
    };
    buildDistinguishedName = (dn) => {
      return [
        `CN=${escapeDnValue(dn.commonName)}`,
        `OU=${escapeDnValue(dn.organizationalUnit)}`,
        `O=${escapeDnValue(dn.organization)}`,
        `L=${escapeDnValue(dn.locality)}`,
        `C=${escapeDnValue(dn.country)}`
      ].join(", ");
    };
    buildKeyProperties = ({ jksName, alias, password }) => {
      return [
        "# \u7531 aqutter android gen-jks \u7522\u751F\uFF1B\u5DF2\u88AB .gitignore \u5FFD\u7565\uFF0C\u52FF\u63D0\u4EA4\u3002",
        `storePassword=${password}`,
        `keyPassword=${password}`,
        `keyAlias=${alias}`,
        `storeFile=${STORE_FILE_PREFIX_FROM_APP_MODULE}${jksName}`,
        ""
      ].join("\n");
    };
    buildKeytoolArgs = (options) => [
      "-genkeypair",
      "-v",
      "-keystore",
      options.jksPath,
      "-alias",
      options.alias,
      "-keyalg",
      KEY_ALGORITHM,
      "-keysize",
      KEY_SIZE,
      "-validity",
      String(options.validityDays),
      "-storetype",
      STORE_TYPE,
      "-dname",
      options.distinguishedName,
      "-storepass:env",
      PASSWORD_ENV_KEY,
      "-keypass:env",
      PASSWORD_ENV_KEY
    ];
    runGenJks = async (project, argv) => {
      void argv;
      const androidDir = join15(project.appDir, "android");
      const keyPropertiesFile = join15(androidDir, "key.properties");
      const gitignoreLabel = `${project.config.appDir}/android/.gitignore`;
      const {
        askWithDefault,
        askRequired,
        askSecret,
        askYesNo,
        close: closePrompter
      } = createPrompter({
        onClose: () => fail8("\u8F38\u5165\u5DF2\u7D50\u675F\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002")
      });
      const askPassword = async () => {
        for (; ; ) {
          const first = await askSecret(`keystore \u5BC6\u78BC\uFF08\u81F3\u5C11 ${MIN_PASSWORD_LENGTH} \u5B57\u5143\uFF0Cstore \u8207 key \u5171\u7528\uFF09\uFF1A`);
          if (!isValidPassword(first)) {
            console.log(`  \u5BC6\u78BC\u9577\u5EA6\u4E0D\u8DB3 ${MIN_PASSWORD_LENGTH} \u5B57\u5143\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u3002`);
            continue;
          }
          const second = await askSecret("\u518D\u8F38\u5165\u4E00\u6B21\u78BA\u8A8D\uFF1A");
          if (first === second) {
            return first;
          }
          console.log("  \u5169\u6B21\u8F38\u5165\u4E0D\u4E00\u81F4\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u3002");
        }
      };
      const askValidityYears = async () => {
        for (; ; ) {
          const years = parseValidityYears(await askWithDefault("\u6191\u8B49\u6709\u6548\u5E74\u6578", String(DEFAULT_VALIDITY_YEARS)));
          if (years !== null) {
            return years;
          }
          console.log("  \u8ACB\u8F38\u5165\u6B63\u6574\u6578\u5E74\u6578\u3002");
        }
      };
      const askDistinguishedName = async () => {
        console.log("\n--- \u6191\u8B49\u4E3B\u9AD4\u8CC7\u8A0A\uFF08\u6703\u5BEB\u9032\u6191\u8B49\uFF0C\u5B89\u88DD\u5F8C\u4E0D\u53EF\u66F4\u6539\uFF09---");
        const commonName = await askRequired("\u6191\u8B49\u64C1\u6709\u8005\u540D\u7A31\uFF08CN\uFF0C\u516C\u53F8\u540D\u6216\u7522\u54C1\u540D\uFF0C\u4F8B\uFF1AMyCompany\uFF09");
        const organizationalUnit = await askRequired("\u90E8\u9580 / \u55AE\u4F4D\u540D\u7A31\uFF08OU\uFF0C\u4F8B\uFF1AMobile\uFF09");
        const organization = await askRequired("\u516C\u53F8 / \u7D44\u7E54\u540D\u7A31\uFF08O\uFF0C\u4F8B\uFF1AMy Company Ltd.\uFF09");
        const locality = await askWithDefault("\u6240\u5728\u57CE\u5E02\uFF08L\uFF09", DEFAULT_LOCALITY);
        const country = await askWithDefault("\u570B\u5BB6\u4EE3\u78BC\uFF08C\uFF0C\u5169\u78BC\uFF09", DEFAULT_COUNTRY);
        return buildDistinguishedName({
          commonName,
          organizationalUnit,
          organization,
          locality,
          country
        });
      };
      const ensureCanWrite = async (filePath, label) => {
        if (!existsSync13(filePath)) {
          return;
        }
        const overwrite = await askYesNo(`${label} \u5DF2\u5B58\u5728\uFF08${relative8(project.root, filePath)}\uFF09\uFF0C\u662F\u5426\u8986\u5BEB\uFF1F`);
        if (!overwrite) {
          fail8("\u5DF2\u53D6\u6D88\uFF0C\u672A\u8B8A\u66F4\u4EFB\u4F55\u6A94\u6848\u3002");
        }
        unlinkSync(filePath);
      };
      const runKeytool = (keytool2, options) => {
        const result = spawnSync5(keytool2, buildKeytoolArgs(options), {
          stdio: "inherit",
          env: {
            ...process.env,
            [PASSWORD_ENV_KEY]: options.password
          }
        });
        if (result.status !== 0) {
          fail8(`keytool \u57F7\u884C\u5931\u6557\uFF08exit ${result.status ?? "signal"}\uFF09\u3002`);
        }
      };
      const keytool = locateKeytool();
      if (keytool === null) {
        return fail8("\u627E\u4E0D\u5230 keytool\u3002\u8ACB\u5B89\u88DD JDK \u4E26\u78BA\u4FDD keytool \u5728 PATH \u4E0A\uFF0C\u6216\u8A2D\u5B9A JAVA_HOME\u3002");
      }
      console.log("=== \u7522\u751F Android release keystore ===");
      console.log(`\u7522\u51FA\u76EE\u9304\uFF1A${relative8(project.root, androidDir)}
`);
      const jksName = normalizeJksName(await askWithDefault("keystore \u6A94\u540D", `${DEFAULT_JKS_NAME}${JKS_EXTENSION}`));
      const alias = await askWithDefault("\u91D1\u9470\u5225\u540D\uFF08alias\uFF09", DEFAULT_ALIAS);
      const password = await askPassword();
      const validityYears = await askValidityYears();
      const distinguishedName = await askDistinguishedName();
      const jksPath = join15(androidDir, jksName);
      await ensureCanWrite(jksPath, "keystore");
      await ensureCanWrite(keyPropertiesFile, "key.properties");
      console.log(`
\u57F7\u884C keytool\uFF08\u6709\u6548\u671F ${validityYears} \u5E74\uFF0C\u4E3B\u9AD4 ${distinguishedName}\uFF09\u2026
`);
      runKeytool(keytool, {
        jksPath,
        alias,
        validityDays: validityYears * DAYS_PER_YEAR,
        distinguishedName,
        password
      });
      writeFileSync9(keyPropertiesFile, buildKeyProperties({ jksName, alias, password }), "utf8");
      console.log("\n\u5B8C\u6210\uFF1A");
      console.log(`  keystore       \u2192 ${relative8(project.root, jksPath)}`);
      console.log(`  key.properties \u2192 ${relative8(project.root, keyPropertiesFile)}`);
      console.log(`\u5169\u500B\u6A94\u6848\u7686\u5DF2\u88AB ${gitignoreLabel} \u5FFD\u7565\uFF0C\u8ACB\u81EA\u884C\u5099\u4EFD keystore \u8207\u5BC6\u78BC\uFF1B\u907A\u5931\u5373\u7121\u6CD5\u518D\u66F4\u65B0\u5DF2\u4E0A\u67B6\u7684 App\u3002`);
      closePrompter();
    };
  }
});

// src/main.ts
init_config();
init_package();
var HELP = `aqutter ${package_default.version}

\u7528\u6CD5\uFF1Aaqutter <\u6307\u4EE4> [\u53C3\u6578]

\u6307\u4EE4\uFF1A
  init                 \u5728\u65E2\u6709\u7DB2\u9801\u5C08\u6848\u52A0\u5165 Aqutter\uFF08\u7522\u751F aqutter.config.json \u8207 Flutter App \u76EE\u9304\uFF09
  dev [target]         \u540C\u8DD1\u7DB2\u9801 dev server \u8207 flutter run\uFF08target: macos|windows|linux|ios|ios-device|android|<device id>\uFF09
  seed                 \u7522\u751F\u975C\u614B\u7DB2\u9801\u4E26\u6253\u5305\u7A2E\u5B50\u7DB2\u9801\u5305\uFF08\u540C\u6642\u4EA4\u4ED8 web_<env>_<\u7248\u672C>.zip\uFF09
  build <platform>     \u6253\u5305 App\uFF08apk|aab|ios|ipa|macos|windows|linux\uFF09\uFF0C\u542B\u7A2E\u5B50\u3001\u7C3D\u7AE0\u3001\u4EA4\u4ED8
  flavor add [<name>]  \u70BA Android / iOS / macOS \u65B0\u589E flavor
  android gen-jks      \u7522\u751F Android \u7C3D\u7AE0\u7528 keystore \u8207 key.properties
  plugin create <name> \u7522\u751F Aqutter plugin \u5C08\u6848
  plugin add <pkg>     \u628A plugin \u52A0\u5165\u76EE\u524D\u5C08\u6848

\u901A\u7528\u65D7\u6A19\uFF08dev / seed / build\uFF09\uFF1A--env=<env \u6A94> --x-env=<\u540D\u7A31> --flavor=<\u540D\u7A31>\uFF1B\u8A73\u898B\u5404\u6307\u4EE4\u8AAA\u660E\u3002
`;
var main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  if (command === void 0 || command === "-h" || command === "--help" || command === "help") {
    console.log(HELP);
    return;
  }
  if (command === "-v" || command === "--version") {
    console.log(package_default.version);
    return;
  }
  if (command === "init") {
    const { runInit: runInit2 } = await Promise.resolve().then(() => (init_init(), init_exports));
    await runInit2(process.cwd(), rest);
    return;
  }
  if (command === "plugin") {
    const { runPlugin: runPlugin2 } = await Promise.resolve().then(() => (init_plugin(), plugin_exports));
    await runPlugin2(process.cwd(), rest);
    return;
  }
  const project = loadProject(process.cwd());
  switch (command) {
    case "dev": {
      const { runDev: runDev2 } = await Promise.resolve().then(() => (init_dev(), dev_exports));
      await runDev2(project, rest);
      return;
    }
    case "seed": {
      const { runSeed: runSeed2 } = await Promise.resolve().then(() => (init_seed(), seed_exports));
      await runSeed2(project, rest);
      return;
    }
    case "build": {
      const { runBuild: runBuild2 } = await Promise.resolve().then(() => (init_build(), build_exports));
      await runBuild2(project, rest);
      return;
    }
    case "flavor": {
      if (rest[0] !== "add") {
        throw new ConfigError("\u7528\u6CD5\uFF1Aaqutter flavor add [<name>]");
      }
      const { runFlavorAdd: runFlavorAdd2 } = await Promise.resolve().then(() => (init_flavorAdd(), flavorAdd_exports));
      await runFlavorAdd2(project, rest.slice(1));
      return;
    }
    case "android": {
      if (rest[0] !== "gen-jks") {
        throw new ConfigError("\u7528\u6CD5\uFF1Aaqutter android gen-jks");
      }
      const { runGenJks: runGenJks2 } = await Promise.resolve().then(() => (init_genJks(), genJks_exports));
      await runGenJks2(project, rest.slice(1));
      return;
    }
    default:
      throw new ConfigError(`\u672A\u77E5\u6307\u4EE4\u300C${command}\u300D\u3002\u57F7\u884C \`aqutter help\` \u67E5\u770B\u7528\u6CD5\u3002`);
  }
};
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
