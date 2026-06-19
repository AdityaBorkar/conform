import { defineTemplate, rule } from "@/template-api/index.ts";

type JsrConfig = {
  name?: string;
  version?: string;
  exports?: Record<string, string> | string;
  description?: string;
  runtimeCompat?: {
    deno?: boolean;
    node?: boolean;
    bun?: boolean;
    browser?: boolean;
    workerd?: boolean;
  };
};

function resolveJsrConfig(ctx: {
  readJson: <T = unknown>(relPath: string) => T | null;
  packageJson?: { description?: string } | null;
}): { jsr: JsrConfig | null; source: string } {
  const jsr = ctx.readJson<JsrConfig>("jsr.json");
  if (jsr) return { jsr, source: "jsr.json" };
  const deno = ctx.readJson<JsrConfig>("deno.json");
  if (deno) return { jsr: deno, source: "deno.json" };
  return { jsr: null, source: "package.json" };
}

function getExportPaths(ctx: {
  readJson: <T = unknown>(relPath: string) => T | null;
}): string[] {
  const config = resolveJsrConfig(ctx);
  const exports = config.jsr?.exports;
  if (!exports) return [];
  if (typeof exports === "string") return [exports];
  return Object.values(exports);
}

const FENCED_CODE_RE = /```|~~~/;
const INDENTED_CODE_RE = /\n\s*?\n( {4}|\t)[^\S\n]*\S/;

function hasCodeBlock(content: string): boolean {
  return FENCED_CODE_RE.test(content) || INDENTED_CODE_RE.test(content);
}

const EXPORTED_SYMBOL_RE =
  /export\s+(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
const JSDOC_PRECEDING_RE = /\*\/\s*$/;

function countDocumentedSymbols(content: string): {
  total: number;
  documented: number;
} {
  let total = 0;
  let documented = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const textBefore = (idx: number) =>
    content.slice(Math.max(0, idx - 200), idx);

  match = EXPORTED_SYMBOL_RE.exec(content);
  while (match !== null) {
    if (match.index >= lastIndex) {
      lastIndex = match.index;
      total++;
      const before = textBefore(match.index);
      if (JSDOC_PRECEDING_RE.test(before)) {
        documented++;
      }
    }
    match = EXPORTED_SYMBOL_RE.exec(content);
  }
  return { documented, total };
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

export default defineTemplate({
  description: "Conformance rules for publishing an NPM package",
  name: "npm-publish",
  rules: [
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
      check: (ctx) => {
        const pkg = ctx.packageJson;
        const entries = [
          pkg?.main && `main`,
          pkg?.module && `module`,
          pkg?.exports && `exports`,
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
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
    rule({
      check: (ctx) => {
        const readme = ctx.readFile("README.md");
        if (readme && hasCodeBlock(readme)) {
          return { message: "README contains code examples", status: "pass" };
        }
        return {
          message:
            "README.md does not contain fenced (``` or ~~~) or indented code blocks — JSR requires examples for full documentation score",
          status: "fail",
        };
      },
      description:
        "README contains code examples (JSR: has_readme_examples — 1pt)",
      group: "jsr:documentation",
      id: "jsr:readme-examples",
      severity: "fail",
    }),
    rule({
      check: (ctx) => {
        const config = resolveJsrConfig(ctx);
        const exportPaths = getExportPaths(ctx);
        if (exportPaths.length === 0) {
          return {
            message: "no exports defined — skipping entrypoint doc check",
            status: "pass",
          };
        }
        const readmeExists = ctx.readFile("README.md") !== null;
        const missing: string[] = [];
        const mainExport =
          typeof config.jsr?.exports === "string"
            ? config.jsr.exports
            : config.jsr?.exports?.["."];
        for (const expPath of exportPaths) {
          if (expPath === mainExport && readmeExists) continue;
          const content = ctx.readFile(expPath);
          if (content === null) continue;
          const hasModuleDoc = /^\s*\/\*\*[\s\S]*?\*\//.test(content);
          if (!hasModuleDoc) {
            missing.push(expPath);
          }
        }
        if (missing.length === 0) {
          return {
            message: "all entrypoints have module docs",
            status: "pass",
          };
        }
        return {
          message: `entrypoints missing JSDoc module documentation: ${missing.join(", ")}`,
          status: "fail",
        };
      },
      description:
        "all exported entrypoints have JSDoc module documentation (JSR: all_entrypoints_docs — 1pt)",
      group: "jsr:documentation",
      id: "jsr:entrypoint-module-docs",
      severity: "fail",
    }),
    rule({
      check: (ctx) => {
        const exportPaths = getExportPaths(ctx);
        if (exportPaths.length === 0) {
          return {
            message: "no exports defined — skipping symbol doc check",
            status: "pass",
          };
        }
        let total = 0;
        let documented = 0;
        const filesUnderThreshold: string[] = [];
        for (const expPath of exportPaths) {
          const content = ctx.readFile(expPath);
          if (content === null) continue;
          const result = countDocumentedSymbols(content);
          total += result.total;
          documented += result.documented;
          if (result.total > 0 && result.documented / result.total < 0.8) {
            filesUnderThreshold.push(
              `${expPath} (${result.documented}/${result.total})`,
            );
          }
        }
        if (total === 0) {
          return {
            message: "no exported symbols found — nothing to document",
            status: "pass",
          };
        }
        const pct = Math.round((documented / total) * 100);
        if (pct >= 80) {
          return {
            message: `${pct}% of exported symbols are documented (${documented}/${total})`,
            status: "pass",
          };
        }
        return {
          message: `only ${pct}% of exported symbols are documented (${documented}/${total}) — JSR requires ≥80% for full score. Files below threshold: ${filesUnderThreshold.join(", ")}`,
          status: "warn",
        };
      },
      description:
        "≥80% of exported symbols have JSDoc documentation (JSR: percentage_documented_symbols — 5pts)",
      group: "jsr:documentation",
      id: "jsr:documented-symbols",
      severity: "warn",
    }),
    rule({
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
          if (content === null) continue;
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
    rule({
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
          if (content === null) continue;
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
    rule({
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
    rule({
      check: (ctx) => {
        const config = resolveJsrConfig(ctx);
        const compat = config.jsr?.runtimeCompat;
        if (!compat) {
          return {
            message:
              "no runtimeCompat field found in jsr.json or deno.json — mark at least one runtime as compatible",
            status: "fail",
          };
        }
        const runtimes = ["deno", "node", "bun", "browser", "workerd"] as const;
        const compatible: string[] = [];
        for (const rt of runtimes) {
          if (compat[rt] === true) {
            compatible.push(rt);
          }
        }
        if (compatible.length === 0) {
          return {
            message:
              "no runtimes marked as compatible in runtimeCompat — mark at least one",
            status: "fail",
          };
        }
        return {
          message: `compatible runtimes: ${compatible.join(", ")}`,
          status: "pass",
        };
      },
      description:
        "at least one runtime marked as compatible (JSR: at_least_one_runtime_compatible — 1pt)",
      group: "jsr:compatibility",
      id: "jsr:runtime-compat",
      severity: "fail",
    }),
    rule({
      check: (ctx) => {
        const config = resolveJsrConfig(ctx);
        const compat = config.jsr?.runtimeCompat;
        if (!compat) {
          return {
            message: "no runtimeCompat field found",
            status: "warn",
          };
        }
        const runtimes = ["deno", "node", "bun", "browser", "workerd"] as const;
        const compatible: string[] = [];
        for (const rt of runtimes) {
          if (compat[rt] === true) {
            compatible.push(rt);
          }
        }
        if (compatible.length >= 2) {
          return {
            message: `compatible runtimes: ${compatible.join(", ")}`,
            status: "pass",
          };
        }
        return {
          message: `only ${compatible.length} runtime(s) marked compatible — JSR rewards ≥2 for full compatibility score`,
          status: "warn",
        };
      },
      description:
        "multiple runtimes marked as compatible (JSR: multiple_runtimes_compatible — 1pt)",
      group: "jsr:compatibility",
      id: "jsr:runtime-compat-multiple",
      severity: "warn",
    }),
  ],
});
