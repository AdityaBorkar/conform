import { defineTemplate, domain } from "@/conform-api/index.ts";

const style = domain("Style & Validation");
const build = domain("Build & Tasks");
const testing = domain("Testing");
const documentation = domain("Documentation");
const devEnv = domain("Dev Environment");
const codeQuality = domain("Code Quality");
const observability = domain("Observability");
const security = domain("Security & Governance");
const github = domain("GitHub Configuration");

interface JsrConfig {
  description?: string;
  exports?: Record<string, string> | string;
  name?: string;
  runtimeCompat?: {
    deno?: boolean;
    node?: boolean;
    bun?: boolean;
    browser?: boolean;
    workerd?: boolean;
  };
  version?: string;
}

function resolveJsrConfig(ctx: {
  readJson: <T = unknown>(relPath: string) => T | null;
  packageJson?: { description?: string } | null;
}): { jsr: JsrConfig | null; source: string } {
  const jsr = ctx.readJson<JsrConfig>("jsr.json");
  if (jsr) {
    return { jsr, source: "jsr.json" };
  }
  const deno = ctx.readJson<JsrConfig>("deno.json");
  if (deno) {
    return { jsr: deno, source: "deno.json" };
  }
  return { jsr: null, source: "package.json" };
}

function getExportPaths(ctx: {
  readJson: <T = unknown>(relPath: string) => T | null;
}): string[] {
  const config = resolveJsrConfig(ctx);
  const exports = config.jsr?.exports;
  if (!exports) {
    return [];
  }
  if (typeof exports === "string") {
    return [exports];
  }
  return Object.values(exports);
}

const SLOW_TYPE_PATTERNS: {
  pattern: RegExp;
  message: string;
}[] = [
  {
    message: "exported function is missing an explicit return type (slow type)",
    pattern: /export\s+function\s+\w+\s*\([^)]*\)\s*\{/,
  },
  {
    message:
      "exported variable with complex initializer is missing a type annotation (slow type)",
    pattern:
      /export\s+(?:const|let)\s+\w+\s*=\s*(?:crypto|Math|Date|JSON|Object|Array|Promise|Symbol|Number|String|Boolean)\b/,
  },
  {
    message:
      "export destructuring is a slow type — export each symbol individually",
    pattern: /export\s+const\s+\{[^}]+\}\s*=/,
  },
  {
    message: "CommonJS export syntax is a slow type — use ESM export syntax",
    pattern: /export\s*=\s*(?!module\.exports)/,
  },
  {
    message: "CommonJS import syntax is a slow type — use ESM import syntax",
    pattern: /import\s+\w+\s*=\s*require\s*\(/,
  },
  {
    message: "global augmentation is a slow type",
    pattern: /declare\s+global\s*\{/,
  },
  {
    message: "module augmentation is a slow type",
    pattern: /declare\s+module\s+/,
  },
  {
    message: "export as namespace is a slow type",
    pattern: /export\s+as\s+namespace\s+/,
  },
  {
    message: "exported class property is missing a type annotation (slow type)",
    pattern: /export\s+class\s+\w+[^{]*\b\w+\s*[;=]/,
  },
];

const CI_WORKFLOW_CANDIDATES = [
  ".github/workflows/ci.yml",
  ".github/workflows/ci.yaml",
  ".github/workflows/test.yml",
  ".github/workflows/test.yaml",
  ".github/workflows/build.yml",
  ".github/workflows/build.yaml",
  ".github/workflows/check.yml",
  ".github/workflows/check.yaml",
];

const RELEASE_WORKFLOW_CANDIDATES = [
  ".github/workflows/release.yml",
  ".github/workflows/release.yaml",
  ".github/workflows/publish.yml",
  ".github/workflows/publish.yaml",
  ".github/workflows/deploy.yml",
  ".github/workflows/deploy.yaml",
];

function findWorkflowFile(
  ctx: { readFile: (p: string) => string | null },
  candidates: string[],
): string | null {
  for (const path of candidates) {
    if (ctx.readFile(path) !== null) {
      return path;
    }
  }
  return null;
}

function getBinPaths(pkg: { bin?: unknown }): string[] {
  if (!pkg.bin) {
    return [];
  }
  if (typeof pkg.bin === "string") {
    return [pkg.bin];
  }
  if (typeof pkg.bin === "object" && pkg.bin !== null) {
    return Object.values(pkg.bin as Record<string, string>);
  }
  return [];
}

function hasHeading(content: string, ...titles: string[]): boolean {
  const headingRe = /^#{1,4}\s+(.+)$/gm;
  const matches = [...content.matchAll(headingRe)];
  for (const m of matches) {
    const heading = m[1]?.toLowerCase().trim();
    if (heading && titles.some((t) => heading.includes(t))) {
      return true;
    }
  }
  return false;
}

export default defineTemplate({
  description: "Conformance rules for publishing an NPM package",
  name: "npm-publish",
  rules: [
    // ── Style & Validation ──────────────────────────────────────────

    style.rule({
      check: (ctx) => {
        if (ctx.packageJson?.type !== "module") {
          return {
            message: `type is "${ctx.packageJson?.type ?? "undefined"}", expected "module"`,
            status: "fail",
          };
        }
        return { status: "pass" };
      },
      description: "type is 'module'",
      group: "package.json",
      id: "package-json:type-module",
      severity: "fail",
    }),
    style.rule({
      check: (ctx) => {
        const version = ctx.packageJson?.devDependencies?.["@biomejs/biome"];
        if (version) {
          return { message: version, status: "pass" };
        }
        return {
          message: "@biomejs/biome not found in devDependencies",
          status: "fail",
        };
      },
      description: "@biomejs/biome in devDependencies",
      group: "biome",
      id: "biome:dev-deps",
      severity: "fail",
    }),
    style.rule({
      check: (ctx) => {
        if (ctx.fileExists("biome.json")) {
          return { message: "biome.json", status: "pass" };
        }
        if (ctx.fileExists("biome.jsonc")) {
          return { message: "biome.jsonc", status: "pass" };
        }
        return {
          message: "no biome.json or biome.jsonc found",
          status: "warn",
        };
      },
      description: "biome.json or biome.jsonc exists",
      group: "biome",
      id: "biome:config-file",
      severity: "warn",
    }),
    style.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts ?? {};
        const lintScript = scripts.lint ?? scripts.check;
        if (lintScript?.includes("biome")) {
          return { message: lintScript, status: "pass" };
        }
        return {
          message: "no script running biome check/lint found",
          status: "fail",
        };
      },
      description: "lint or check script runs biome",
      group: "biome",
      id: "biome:lint-script",
      severity: "fail",
    }),
    style.rule({
      check: (ctx) => {
        if (ctx.packageJson?.sideEffects !== undefined) {
          const val = ctx.packageJson.sideEffects;
          return {
            message: `sideEffects: ${typeof val === "boolean" ? val : "array"}`,
            status: "pass",
          };
        }
        return {
          message:
            "sideEffects field is missing — bundlers cannot tree-shake without it (set sideEffects: false or an array of files with side effects)",
          status: "warn",
        };
      },
      description: "sideEffects field is defined in package.json",
      group: "package.json",
      id: "package-json:side-effects",
      severity: "warn",
    }),
    style.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts ?? {};
        const formatScript =
          scripts.format ?? scripts["check:format"] ?? scripts["check:lint"];
        if (formatScript?.includes("biome")) {
          return { message: formatScript, status: "pass" };
        }
        return {
          message:
            "no format script running biome format found — add a format script to enforce consistent style",
          status: "warn",
        };
      },
      description: "format script runs biome",
      group: "biome",
      id: "biome:format-script",
      severity: "warn",
    }),
    // ── Build & Tasks ───────────────────────────────────────────────

    build.rule({
      check: (ctx) => {
        if (!ctx.packageJson?.name) {
          return { message: "name field is missing", status: "fail" };
        }
        return { message: ctx.packageJson.name, status: "pass" };
      },
      description: "name field is present in package.json",
      group: "package.json",
      id: "package-json:name",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        if (!ctx.packageJson?.version) {
          return { message: "version field is missing", status: "fail" };
        }
        return { message: ctx.packageJson.version, status: "pass" };
      },
      description: "version field is present in package.json",
      group: "package.json",
      id: "package-json:version",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        const pkg = ctx.packageJson;
        const entries = [
          pkg?.main && "main",
          pkg?.module && "module",
          pkg?.exports && "exports",
        ].filter(Boolean);
        if (entries.length > 0) {
          return { message: entries.join(", "), status: "pass" };
        }
        return {
          message: "no main, module, or exports field defined",
          status: "fail",
        };
      },
      description: "main, module, or exports entry defined",
      group: "package.json",
      id: "package-json:entry-point",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts;
        if (scripts?.prepare) {
          return { message: "prepare", status: "pass" };
        }
        if (scripts?.build) {
          return { message: "build", status: "pass" };
        }
        return { message: "no prepare or build script found", status: "fail" };
      },
      description: "scripts.prepare or scripts.build exists",
      group: "package.json",
      id: "package-json:build-script",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        if (ctx.packageJson?.files) {
          return { message: "files field defined", status: "pass" };
        }
        if (ctx.fileExists(".npmignore")) {
          return { message: ".npmignore exists", status: "pass" };
        }
        return {
          message: "no files field or .npmignore found",
          status: "warn",
        };
      },
      description: "files field or .npmignore exists",
      group: "package.json",
      id: "package-json:files-or-npmignore",
      severity: "warn",
    }),
    build.rule({
      check: (ctx) => {
        const prepare = ctx.packageJson?.scripts?.prepare;
        if (prepare?.includes("husky")) {
          return { message: prepare, status: "pass" };
        }
        if (!prepare) {
          return { message: "no prepare script found", status: "fail" };
        }
        return {
          message: `prepare is "${prepare}", expected to call husky`,
          status: "fail",
        };
      },
      description: "prepare script calls husky",
      group: "husky",
      id: "husky:prepare-script",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts ?? {};
        const typecheckScript =
          scripts.typecheck ?? scripts["check:types"] ?? scripts.types;
        if (typecheckScript) {
          return { message: typecheckScript, status: "pass" };
        }
        return {
          message:
            "no typecheck script found — add a typecheck or check:types script running tsc --noEmit",
          status: "warn",
        };
      },
      description: "typecheck script exists",
      group: "scripts",
      id: "scripts:typecheck",
      severity: "warn",
    }),
    build.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts;
        if (scripts?.prepublish) {
          return {
            message:
              'prepublish script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.',
            status: "fail",
          };
        }
        return { status: "pass" };
      },
      description: "deprecated prepublish script is not used",
      group: "scripts",
      id: "scripts:no-prepublish",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        const binPaths = getBinPaths(ctx.packageJson ?? {});
        if (binPaths.length === 0) {
          return {
            message: "no bin field — skipping bin file check",
            status: "pass",
          };
        }
        const missing = binPaths.filter((p) => !ctx.fileExists(p));
        if (missing.length > 0) {
          return {
            message: `bin path(s) not found on disk: ${missing.join(", ")}`,
            status: "fail",
          };
        }
        return { status: "pass" };
      },
      description: "bin field references files that exist",
      group: "bin",
      id: "bin:file-exists",
      severity: "fail",
    }),
    build.rule({
      check: (ctx) => {
        const binPaths = getBinPaths(ctx.packageJson ?? {});
        if (binPaths.length === 0) {
          return {
            message: "no bin field — skipping shebang check",
            status: "pass",
          };
        }
        const missingShebang: string[] = [];
        for (const binPath of binPaths) {
          const content = ctx.readFile(binPath);
          if (content === null) {
            continue;
          }
          const firstLine = content.split("\n")[0];
          if (!firstLine?.startsWith("#!")) {
            missingShebang.push(binPath);
          }
        }
        if (missingShebang.length > 0) {
          return {
            message: `bin file(s) missing shebang (#!/usr/bin/env node or bun): ${missingShebang.join(", ")}`,
            status: "fail",
          };
        }
        return { status: "pass" };
      },
      description: "bin entry files have a shebang line",
      group: "bin",
      id: "bin:shebang",
      severity: "fail",
    }),

    // ── Testing ─────────────────────────────────────────────────────

    testing.rule({
      check: (ctx) => {
        const testScript = ctx.packageJson?.scripts?.test;
        if (testScript) {
          return { message: testScript, status: "pass" };
        }
        return {
          message:
            'no test script found — add "test" to scripts (e.g. "bun test" or "vitest")',
          status: "fail",
        };
      },
      description: "scripts.test exists in package.json",
      group: "package.json",
      id: "testing:test-script",
      severity: "fail",
    }),
    testing.rule({
      check: (ctx) => {
        const testScript = ctx.packageJson?.scripts?.test;
        if (!testScript) {
          return {
            message: "no test script — skipping runner check",
            status: "pass",
          };
        }
        const isNoOp =
          testScript.includes("echo") || testScript.trim() === "exit 0";
        if (isNoOp) {
          return {
            message: `test script appears to be a placeholder: "${testScript}"`,
            status: "warn",
          };
        }
        const knownRunners =
          /bun\s+test|vitest|jest|mocha|ava|tape|uvu|node\s+--test/;
        if (knownRunners.test(testScript)) {
          return { status: "pass" };
        }
        return {
          message: `test script "${testScript}" does not reference a known test runner`,
          status: "warn",
        };
      },
      description: "test script invokes a known test runner",
      group: "package.json",
      id: "testing:test-runner",
      severity: "warn",
    }),

    // ── Documentation ───────────────────────────────────────────────

    documentation.rule({
      check: (ctx) => {
        if (!ctx.packageJson?.description) {
          return { message: "description field is missing", status: "warn" };
        }
        return { status: "pass" };
      },
      description: "description field is present in package.json",
      group: "package.json",
      id: "package-json:description",
      severity: "warn",
    }),
    documentation.rule({
      check: (ctx) => {
        const content = ctx.readFile("README.md");
        if (content === null) {
          return { message: "README.md not found", status: "fail" };
        }
        if (content.trim().length === 0) {
          return { message: "README.md is empty", status: "fail" };
        }
        return { status: "pass" };
      },
      description: "README.md exists and is non-empty (JSR: has_readme — 2pts)",
      group: "files",
      id: "files:readme",
      severity: "fail",
    }),
    documentation.rule({
      check: (ctx) => {
        const config = resolveJsrConfig(ctx);
        const description =
          config.jsr?.description ?? ctx.packageJson?.description;
        if (description && description.trim().length > 0) {
          return {
            message: `description found in ${config.jsr ? config.source : "package.json"}`,
            status: "pass",
          };
        }
        return {
          message: `no description found in ${config.source} or package.json — JSR requires a description for discoverability`,
          status: "fail",
        };
      },
      description:
        "package has a description for discoverability (JSR: has_description — 1pt)",
      group: "jsr:discoverability",
      id: "jsr:has-description",
      severity: "fail",
    }),
    documentation.rule({
      check: (ctx) => {
        const changelogPaths = ["CHANGELOG.md", "CHANGELOG", "HISTORY.md"];
        for (const path of changelogPaths) {
          if (ctx.fileExists(path)) {
            return { message: path, status: "pass" };
          }
        }
        return {
          message:
            "no CHANGELOG.md found — users and consumers need to see what changed between versions",
          status: "warn",
        };
      },
      description: "CHANGELOG.md exists",
      group: "files",
      id: "docs:changelog",
      severity: "warn",
    }),
    documentation.rule({
      check: (ctx) => {
        if (ctx.fileExists("CONTRIBUTING.md")) {
          return { status: "pass" };
        }
        if (ctx.fileExists(".github/CONTRIBUTING.md")) {
          return { message: ".github/CONTRIBUTING.md", status: "pass" };
        }
        return {
          message:
            "no CONTRIBUTING.md found — open source packages should tell contributors how to participate",
          status: "warn",
        };
      },
      description: "CONTRIBUTING.md exists",
      group: "files",
      id: "docs:contributing",
      severity: "warn",
    }),
    documentation.rule({
      check: (ctx) => {
        const readme = ctx.readFile("README.md");
        if (!readme) {
          return {
            message: "README.md not found — skipping install section check",
            status: "pass",
          };
        }
        if (
          hasHeading(
            readme,
            "install",
            "installation",
            "getting started",
            "setup",
          )
        ) {
          return { status: "pass" };
        }
        return {
          message:
            "README.md has no Installation section — add ## Install or ## Getting Started",
          status: "warn",
        };
      },
      description: "README has an Installation section",
      group: "readme",
      id: "docs:readme-install",
      severity: "warn",
    }),
    documentation.rule({
      check: (ctx) => {
        const readme = ctx.readFile("README.md");
        if (!readme) {
          return {
            message: "README.md not found — skipping usage section check",
            status: "pass",
          };
        }
        if (
          hasHeading(readme, "usage", "quick start", "example", "basic usage")
        ) {
          return { status: "pass" };
        }
        return {
          message:
            "README.md has no Usage section — add ## Usage or ## Quick Start",
          status: "warn",
        };
      },
      description: "README has a Usage section",
      group: "readme",
      id: "docs:readme-usage",
      severity: "warn",
    }),

    // ── Dev Environment ─────────────────────────────────────────────

    devEnv.rule({
      check: (ctx) => {
        if (ctx.packageJson?.devDependencies?.husky) {
          return {
            message: ctx.packageJson.devDependencies.husky,
            status: "pass",
          };
        }
        return {
          message: "husky not found in devDependencies",
          status: "fail",
        };
      },
      description: "husky in devDependencies",
      group: "husky",
      id: "husky:dev-deps",
      severity: "fail",
    }),
    devEnv.rule({
      check: (ctx) => {
        if (ctx.fileExists(".husky")) {
          return { status: "pass" };
        }
        return { message: ".husky/ directory not found", status: "fail" };
      },
      description: ".husky/ directory exists",
      group: "husky",
      id: "husky:hooks-dir",
      severity: "fail",
    }),
    devEnv.rule({
      check: (ctx) => {
        if (ctx.fileExists(".husky/pre-commit")) {
          return { status: "pass" };
        }
        return { message: "no pre-commit hook found", status: "warn" };
      },
      description: "pre-commit hook exists",
      group: "husky",
      id: "husky:pre-commit-hook",
      severity: "warn",
    }),
    devEnv.rule({
      check: (ctx) => {
        if (ctx.fileExists(".husky/commit-msg")) {
          return { status: "pass" };
        }
        return { message: "no commit-msg hook found", status: "warn" };
      },
      description: "commit-msg hook exists",
      group: "husky",
      id: "husky:commit-msg-hook",
      severity: "warn",
    }),
    devEnv.rule({
      check: (ctx) => {
        if (ctx.fileExists(".gitignore")) {
          return { status: "pass" };
        }
        return { message: ".gitignore not found", status: "fail" };
      },
      description: ".gitignore exists",
      group: "files",
      id: "files:gitignore",
      severity: "fail",
    }),
    devEnv.rule({
      check: (ctx) => {
        const lockfiles = [
          "bun.lock",
          "bun.lockb",
          "package-lock.json",
          "pnpm-lock.yaml",
          "yarn.lock",
        ];
        for (const lf of lockfiles) {
          if (ctx.fileExists(lf)) {
            return { message: lf, status: "pass" };
          }
        }
        return {
          message:
            "no lockfile found — committed lockfiles ensure reproducible installs across environments",
          status: "fail",
        };
      },
      description: "lockfile exists (bun.lock, package-lock.json, etc.)",
      group: "lockfile",
      id: "lockfile:exists",
      severity: "fail",
    }),
    devEnv.rule({
      check: (ctx) => {
        const gitignore = ctx.readFile(".gitignore");
        if (!gitignore) {
          return {
            message: ".gitignore not found — skipping content check",
            status: "pass",
          };
        }
        if (gitignore.includes("node_modules")) {
          return { status: "pass" };
        }
        return {
          message:
            '.gitignore does not include "node_modules" — accidentally committing it is catastrophic',
          status: "fail",
        };
      },
      description: '.gitignore contains "node_modules"',
      group: "gitignore",
      id: "gitignore:node-modules",
      severity: "fail",
    }),
    devEnv.rule({
      check: (ctx) => {
        const gitignore = ctx.readFile(".gitignore");
        if (!gitignore) {
          return {
            message: ".gitignore not found — skipping content check",
            status: "pass",
          };
        }
        if (/^\.env/m.test(gitignore) || /\.env\*/m.test(gitignore)) {
          return { status: "pass" };
        }
        return {
          message:
            '.gitignore does not include ".env" — secrets must never be committed',
          status: "fail",
        };
      },
      description: '.gitignore contains ".env"',
      group: "gitignore",
      id: "gitignore:env",
      severity: "fail",
    }),

    // ── Code Quality ────────────────────────────────────────────────

    codeQuality.rule({
      check: (ctx) => {
        const version =
          ctx.packageJson?.devDependencies?.typescript ??
          ctx.packageJson?.peerDependencies?.typescript;
        if (version) {
          return { message: version, status: "pass" };
        }
        return {
          message:
            "typescript not found in devDependencies or peerDependencies",
          status: "fail",
        };
      },
      description: "typescript in devDependencies or peerDependencies",
      group: "typescript",
      id: "typescript:deps",
      severity: "fail",
    }),
    codeQuality.rule({
      check: (ctx) => {
        if (ctx.fileExists("tsconfig.json")) {
          return { status: "pass" };
        }
        return { message: "tsconfig.json not found", status: "fail" };
      },
      description: "tsconfig.json exists",
      group: "typescript",
      id: "typescript:tsconfig",
      severity: "fail",
    }),
    codeQuality.rule({
      check: (ctx) => {
        const tsconfig = ctx.readJson<{
          compilerOptions?: { strict?: boolean };
        }>("tsconfig.json");
        if (tsconfig?.compilerOptions?.strict === true) {
          return { status: "pass" };
        }
        return {
          message: "strict mode not enabled in tsconfig.json",
          status: "fail",
        };
      },
      description: "strict: true in tsconfig",
      group: "typescript",
      id: "typescript:strict",
      severity: "fail",
    }),
    codeQuality.rule({
      check: (ctx) => {
        const tsconfig = ctx.readJson<{
          compilerOptions?: { noUncheckedIndexedAccess?: boolean };
        }>("tsconfig.json");
        if (tsconfig?.compilerOptions?.noUncheckedIndexedAccess === true) {
          return { status: "pass" };
        }
        return {
          message:
            "noUncheckedIndexedAccess is not enabled — array/object index access should return T | undefined to catch runtime errors",
          status: "fail",
        };
      },
      description: "noUncheckedIndexedAccess: true in tsconfig",
      group: "typescript",
      id: "typescript:no-unchecked-indexed-access",
      severity: "fail",
    }),
    codeQuality.rule({
      check: (ctx) => {
        const tsconfig = ctx.readJson<{
          compilerOptions?: { isolatedModules?: boolean };
        }>("tsconfig.json");
        if (tsconfig?.compilerOptions?.isolatedModules === true) {
          return { status: "pass" };
        }
        return {
          message:
            "isolatedModules is not enabled — required for Bun, esbuild, and SWC which transpile files individually",
          status: "fail",
        };
      },
      description: "isolatedModules: true in tsconfig",
      group: "typescript",
      id: "typescript:isolated-modules",
      severity: "fail",
    }),
    codeQuality.rule({
      check: (ctx) => {
        const tsconfig = ctx.readJson<{
          compilerOptions?: { verbatimModuleSyntax?: boolean };
        }>("tsconfig.json");
        if (tsconfig?.compilerOptions?.verbatimModuleSyntax === true) {
          return { status: "pass" };
        }
        return {
          message:
            "verbatimModuleSyntax is not enabled — prevents CJS/ESM mismatches by preserving import/export syntax exactly",
          status: "warn",
        };
      },
      description: "verbatimModuleSyntax: true in tsconfig",
      group: "typescript",
      id: "typescript:verbatim-module-syntax",
      severity: "warn",
    }),
    codeQuality.rule({
      check: (ctx) => {
        const exportPaths = getExportPaths(ctx);
        if (exportPaths.length === 0) {
          return {
            message: "no exports defined — skipping slow types check",
            status: "pass",
          };
        }
        const violations: string[] = [];
        for (const expPath of exportPaths) {
          const content = ctx.readFile(expPath);
          if (content === null) {
            continue;
          }
          for (const { pattern, message } of SLOW_TYPE_PATTERNS) {
            if (pattern.test(content)) {
              violations.push(`${expPath}: ${message}`);
            }
          }
        }
        if (violations.length === 0) {
          return { message: "no slow types detected", status: "pass" };
        }
        return {
          message: `slow types detected:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
          status: "fail",
        };
      },
      description:
        "no slow types in exported symbols (JSR: all_fast_check — 5pts)",
      group: "jsr:best-practices",
      id: "jsr:no-slow-types",
      severity: "fail",
    }),

    // ── Observability ───────────────────────────────────────────────

    observability.rule({
      check: (ctx) => {
        if (ctx.packageJson?.bugs) {
          return { status: "pass" };
        }
        return {
          message:
            "bugs field is missing — users need an issue tracker URL to report problems (set bugs.url or bugs as a string)",
          status: "fail",
        };
      },
      description: "bugs field is present in package.json",
      group: "package.json",
      id: "package-json:bugs",
      severity: "fail",
    }),
    observability.rule({
      check: (ctx) => {
        if (ctx.packageJson?.homepage) {
          return { message: ctx.packageJson.homepage, status: "pass" };
        }
        return {
          message:
            "homepage field is missing — helps users find project documentation and support",
          status: "warn",
        };
      },
      description: "homepage field is present in package.json",
      group: "package.json",
      id: "package-json:homepage",
      severity: "warn",
    }),
    observability.rule({
      check: (ctx) => {
        const tsconfig = ctx.readJson<{
          compilerOptions?: {
            noEmit?: boolean;
            sourceMap?: boolean;
          };
        }>("tsconfig.json");
        if (!tsconfig?.compilerOptions) {
          return {
            message: "no tsconfig.json found — skipping source map check",
            status: "pass",
          };
        }
        if (tsconfig.compilerOptions.noEmit === true) {
          return {
            message:
              "noEmit is true — source maps not applicable for raw TS publishing",
            status: "pass",
          };
        }
        if (tsconfig.compilerOptions.sourceMap === true) {
          return { status: "pass" };
        }
        return {
          message:
            "sourceMap is not enabled — without source maps, production stack traces point to compiled output and are nearly impossible to debug",
          status: "warn",
        };
      },
      description: "sourceMap: true in tsconfig (when not noEmit)",
      group: "typescript",
      id: "typescript:source-map",
      severity: "warn",
    }),

    // ── Security & Governance ───────────────────────────────────────

    security.rule({
      check: (ctx) => {
        if (!ctx.packageJson?.license) {
          return { message: "license field is missing", status: "fail" };
        }
        return { message: ctx.packageJson.license, status: "pass" };
      },
      description: "license field is present in package.json",
      group: "package.json",
      id: "package-json:license",
      severity: "fail",
    }),
    security.rule({
      check: (ctx) => {
        if (
          ctx.fileExists("LICENSE") ||
          ctx.fileExists("LICENSE.md") ||
          ctx.fileExists("LICENSE.txt")
        ) {
          return { status: "pass" };
        }
        return { message: "no LICENSE file found", status: "fail" };
      },
      description: "LICENSE file exists",
      group: "files",
      id: "files:license",
      severity: "fail",
    }),
    security.rule({
      check: (ctx) => {
        const scripts = ctx.packageJson?.scripts;
        const dangerousScripts = ["preinstall", "postinstall", "install"];
        const found: string[] = [];
        for (const name of dangerousScripts) {
          if (scripts?.[name]) {
            found.push(name);
          }
        }
        if (found.length > 0) {
          return {
            message: `install lifecycle scripts found: ${found.join(", ")} — these are the #1 supply chain attack vector in npm`,
            status: "fail",
          };
        }
        return { status: "pass" };
      },
      description: "no preinstall/postinstall/install lifecycle scripts",
      group: "package.json",
      id: "package-json:no-install-hooks",
      severity: "fail",
    }),
    security.rule({
      check: (ctx) => {
        if (ctx.packageJson?.engines) {
          const entries = Object.entries(ctx.packageJson.engines);
          return {
            message: entries.map(([k, v]) => `${k}: ${v}`).join(", "),
            status: "pass",
          };
        }
        return {
          message:
            "engines field is missing — declare supported Node/Bun versions to prevent installation on incompatible runtimes",
          status: "warn",
        };
      },
      description: "engines field is present in package.json",
      group: "package.json",
      id: "package-json:engines",
      severity: "warn",
    }),
    security.rule({
      check: (ctx) => {
        if (ctx.fileExists("SECURITY.md")) {
          return { status: "pass" };
        }
        if (ctx.fileExists(".github/SECURITY.md")) {
          return { message: ".github/SECURITY.md", status: "pass" };
        }
        return {
          message:
            "no SECURITY.md found — provides a responsible disclosure path for vulnerability reports",
          status: "warn",
        };
      },
      description: "SECURITY.md exists",
      group: "files",
      id: "files:security-md",
      severity: "warn",
    }),
    security.rule({
      check: (ctx) => {
        const ghDir = ctx.fileExists(".github");
        if (!ghDir) {
          return {
            message: "no .github directory found — cannot check provenance",
            status: "warn",
          };
        }
        const workflowFiles = [
          ".github/workflows/publish.yml",
          ".github/workflows/publish.yaml",
          ".github/workflows/release.yml",
          ".github/workflows/release.yaml",
          ".github/workflows/ci.yml",
          ".github/workflows/ci.yaml",
        ];
        const found: string[] = [];
        for (const wf of workflowFiles) {
          const content = ctx.readFile(wf);
          if (content === null) {
            continue;
          }
          if (
            content.includes("jsr publish") ||
            content.includes("deno publish")
          ) {
            if (content.includes("--no-provenance")) {
              found.push(`${wf} (has --no-provenance — provenance disabled)`);
            } else {
              found.push(wf);
            }
          }
        }
        if (found.length === 0) {
          return {
            message:
              "no GitHub Actions workflow found that runs jsr publish or deno publish — provenance requires publishing from GitHub Actions",
            status: "warn",
          };
        }
        const hasDisabled = found.some((f) => f.includes("--no-provenance"));
        if (hasDisabled) {
          return {
            message: `found publish workflows but provenance may be disabled:\n${found.map((f) => `  - ${f}`).join("\n")}`,
            status: "warn",
          };
        }
        return {
          message: `found publish workflow with provenance: ${found.join(", ")}`,
          status: "pass",
        };
      },
      description:
        "publish workflow uses jsr publish with provenance (JSR: has_provenance — 1pt)",
      group: "jsr:best-practices",
      id: "jsr:provenance",
      severity: "warn",
    }),

    // ── GitHub Configuration ────────────────────────────────────────

    github.rule({
      check: (ctx) => {
        if (!ctx.packageJson?.repository) {
          return { message: "repository field is missing", status: "warn" };
        }
        return { status: "pass" };
      },
      description: "repository field is present in package.json",
      group: "package.json",
      id: "package-json:repository",
      severity: "warn",
    }),
    github.rule({
      check: (ctx) => {
        const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
        if (ciFile) {
          return { message: ciFile, status: "pass" };
        }
        return {
          message:
            "no CI workflow found — expected .github/workflows/{ci,test,build,check}.{yml,yaml}",
          status: "fail",
        };
      },
      description: "CI workflow file exists",
      group: "github:ci",
      id: "github:ci-workflow",
      severity: "fail",
    }),
    github.rule({
      check: (ctx) => {
        const releaseFile = findWorkflowFile(ctx, RELEASE_WORKFLOW_CANDIDATES);
        if (releaseFile) {
          return { message: releaseFile, status: "pass" };
        }
        return {
          message:
            "no release/publish workflow found — expected .github/workflows/{release,publish,deploy}.{yml,yaml}",
          status: "warn",
        };
      },
      description: "Release/publish workflow file exists",
      group: "github:release",
      id: "github:release-workflow",
      severity: "warn",
    }),
    github.rule({
      check: (ctx) => {
        const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
        if (!ciFile) {
          return {
            message: "no CI workflow found — skipping content checks",
            status: "pass",
          };
        }
        const content = ctx.readFile(ciFile);
        if (!content) {
          return {
            message: "could not read CI workflow — skipping content checks",
            status: "pass",
          };
        }
        if (
          content.includes("biome") ||
          content.includes("lint") ||
          content.includes("check:lint")
        ) {
          return { status: "pass" };
        }
        return {
          message:
            "CI workflow does not appear to run lint — add a lint step to catch style issues in CI",
          status: "warn",
        };
      },
      description: "CI workflow runs lint",
      group: "github:ci",
      id: "github:ci-lint",
      severity: "warn",
    }),
    github.rule({
      check: (ctx) => {
        const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
        if (!ciFile) {
          return {
            message: "no CI workflow found — skipping content checks",
            status: "pass",
          };
        }
        const content = ctx.readFile(ciFile);
        if (!content) {
          return {
            message: "could not read CI workflow — skipping content checks",
            status: "pass",
          };
        }
        if (
          content.includes("tsc") ||
          content.includes("typecheck") ||
          content.includes("check:types")
        ) {
          return { status: "pass" };
        }
        return {
          message:
            "CI workflow does not appear to run typecheck — add a typecheck step to catch type errors in CI",
          status: "warn",
        };
      },
      description: "CI workflow runs typecheck",
      group: "github:ci",
      id: "github:ci-typecheck",
      severity: "warn",
    }),
    github.rule({
      check: (ctx) => {
        if (ctx.fileExists(".github/dependabot.yml")) {
          return { message: ".github/dependabot.yml", status: "pass" };
        }
        if (ctx.fileExists(".github/dependabot.yaml")) {
          return { message: ".github/dependabot.yaml", status: "pass" };
        }
        if (ctx.fileExists("renovate.json")) {
          return { message: "renovate.json", status: "pass" };
        }
        if (ctx.fileExists(".renovaterc")) {
          return { message: ".renovaterc", status: "pass" };
        }
        if (ctx.fileExists(".renovaterc.json")) {
          return { message: ".renovaterc.json", status: "pass" };
        }
        return {
          message:
            "no Dependabot or Renovate config found — automated dependency updates prevent security drift",
          status: "warn",
        };
      },
      description: "Dependabot or Renovate config exists",
      group: "github:automation",
      id: "github:dependabot",
      severity: "warn",
    }),
  ],
});
