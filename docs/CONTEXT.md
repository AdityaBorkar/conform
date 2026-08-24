# CONTEXT.md — @adistack/conform

## What It Is

`@adistack/conform` is a CLI that checks whether a repository conforms to a predefined **preset** (a named collection of `Plugin`s). It detects drift between a repo's actual state and the expected state, and reports that drift in the terminal (TUI) or as JSON.

## Core Problem

Teams scaffold repos from presets but drift accumulates — missing hooks, dropped config fields, absent CI files, weak `tsconfig` settings, supply-chain risky lifecycle scripts. There is no automated way to verify conformance. Conform fills that gap, CI-friendly, no auto-fix.

## Design Principles

1. **presets are code** — TypeScript modules exporting a `preset`, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it. Simpler, safer, deterministic.
3. **Opinionated with oxc-style overrides** — `preset.rules` and `ConformConfig.rules` are `RuleOverrides` (`Record<string, RuleSeverity | [RuleSeverity, ...opts]>`) where severity `"off"` skips, `"warn"/"error"/"fail"` coerce non-pass, `"pass"` keeps pass. Per-repo tuning is allowed but explicit.
4. **Atomic rules, grouped display** — Each check is one atomic `Rule`. The TUI groups by `domain` then `files` (or by `files` with `--group files`). See ADR 002.
5. **Zero config from CLI** — preset selection lives in `conform.config.ts` (`preset: string`). No `--preset` flag. Additional `plugins`/`rules` can be merged there.
6. **Plugins own context** — A `Plugin<T>` declares `context: (targetPath: string) => T`; each rule receives `{ context: T }` via its `test` function. Standalone rules (`defineRule`) receive `targetPath: string` directly. All FS access goes through `src/utils/fs.ts` (`fileExists`, `readFile`, `readJson`, `packageJson`).

## Domain Model

Source of truth: `src/types.ts` + `src/api/*`. This section mirrors those types verbatim.

```ts
// src/types.ts
export type Severity = "pass" | "warn" | "fail";
export type GroupBy = "domains" | "files";

export interface CheckResult { status: Severity; message?: string }

export interface Rule {
  id: string;            // namespaced as `pluginId:ruleId`
  domain: string;        // e.g. DOMAIN.BUILD = "Build & Tasks"
  files: string[];       // file paths the rule concerns
  description: string;
  check: (ctx: string) => CheckResult | Promise<CheckResult>;
}

export interface Plugin { id: string; rules: Rule[] }

export type RuleSeverity = Severity | "off" | "error"; // "error" → "fail"
export type RuleConfig = RuleSeverity | [RuleSeverity, ...unknown[]];
export type RuleOverrides = Record<string, RuleConfig>;

export interface preset {
  name: string;
  description: string;
  plugins: Plugin[];
  rules?: RuleOverrides; // oxc-style severity overrides
}

export interface RuleResult {
  id: string;
  domain: string;
  files: string[];
  description: string;
  status: Severity;
  message?: string;
}

export interface ConformConfig {
  preset: string;
  plugins?: Plugin[];
  rules?: RuleOverrides;
}

export interface ConformOutput {
  preset: string;
  path: string;
  results: RuleResult[]; // filtered by verbose (hidden pass unless -v)
  summary: { pass: number; warn: number; fail: number };
  groupBy?: GroupBy;     // only "files" is emitted; "domains" is default
}

export interface PackageJson { name?: string; version?: string; description?: string; license?: string; type?: string; main?: string; module?: string; exports?: unknown; bin?: unknown; files?: string[]; homepage?: string; repository?: unknown; bugs?: unknown; sideEffects?: boolean | string[]; engines?: Record<string, string>; dependencies?: Record<string,string>; devDependencies?: Record<string,string>; peerDependencies?: Record<string,string>; scripts?: Record<string,string>; }
// helpers
export const Status = { pass(msg?): CheckResult, warn(msg?): CheckResult, fail(msg?): CheckResult }
export const DOMAIN = { BUILD, CODE_QUALITY, DEV_ENVIRONMENT, DOCUMENTATION, GITHUB_CONFIG, OBSERVABILITY, SECURITY, STYLE, TESTING } // src/plugins/utils/domain.ts
```

`CheckContext` from earlier drafts does not exist. Rules do not receive `readFile`/`readJson`/`packageJson` directly; they receive either `targetPath: string` (standalone `defineRule`) or `{ context: T }` where `T` is the plugin's context object built from `src/utils/fs.ts` helpers.

## Plugin & Rule Authoring API

Preferred path — `definePlugin` / `Plugin`:

```ts
import { definePlugin, Status } from "@adistack/conform";
import { fileExists, packageJson } from "@/utils/fs.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";

export const husky = definePlugin({
  id: "husky",
  domain: DOMAIN.DEV_ENVIRONMENT,
  context: (targetPath) => ({
    fileExists: (p: string) => fileExists(targetPath, p),
    packageJson: () => packageJson(targetPath),
  }),
});

husky.defineRule({
  id: "dev-deps",
  name: "husky in devDependencies",
  test({ context }) {
    const v = context.packageJson()?.devDependencies?.["husky"];
    return v ? Status.pass(v) : Status.fail("husky not found in devDependencies");
  },
});
```

Standalone rule:

```ts
import { defineRule, Status } from "@adistack/conform";
export const myRule = defineRule({
  id: "my-plugin:my-rule",
  domain: DOMAIN.STYLE,
  files: ["biome.json"],
  description: "biome.json exists",
  check: (targetPath) => Status.pass(),
});
```

preset:

```ts
import { definepreset } from "@adistack/conform";
import { husky } from "@/plugins/husky.ts";
// ... other plugins
export default definepreset({
  name: "package",
  description: "Conformance rules for publishing an NPM package",
  plugins: [husky /* …12 more */],
  rules: { "package-json:files-or-npmignore": "warn" }, // optional overrides
});
```

IDs are namespaced as `pluginId:ruleId` by `Plugin`. `definepresetLegacy` exists for back-compat with old `{ rules: Rule[] }` shape.

## preset & Plugin Layout

```
src/presets/        — flat files, each default-exports a preset (definepreset)
  package.ts        — only complete preset (13 plugins); astro-site/monorepo/react-site/webapp are stubs (plugins: [])
src/plugins/ — one file per plugin/domain + utils/domain.ts
  package_json.ts, biome.ts, tsconfig.ts, husky.ts, scripts.ts, bin.ts,
  testing.ts, jsr.ts, docs.ts, gitignore.ts, github.ts, github-config.ts, files.ts
  utils/domain.ts   — DOMAIN constants (human display strings)
```

`src/api/resolver.ts` currently resolves `presets/<name>.ts` or `presets/<name>/index.ts` from repo root (`presets/`). That directory does not exist in the repo — `files: ["src","presets"]` in `package.json` lists it but it is absent. Dogfooded `conform.config.ts` (`preset: "package"`) therefore always fails to resolve today (see Gotchas).

`src/utils/fs.ts` — `fileExists(targetPath, rel)`, `readFile`, `readJson` (strips `//` and `/* */` comments), `packageJson`. `src/utils/config.ts` — `loadConfig(targetPath)` dynamic-imports `conform.config.ts`.

## Config File

```ts
// conform.config.ts in target repo
import { defineConfig } from "@adistack/conform";
export default defineConfig({
  preset: "package",
  // optional, merged by mergepresetWithConfig in src/cli/check.ts
  // plugins: [myPlugin],
  // rules: { "biome:dev-deps": "error", "package-json:no-install-hooks": "off" },
});
```

`loadConfig` requires `config.preset: string`; missing/invalid config causes exit 2. `mergepresetWithConfig` appends `config.plugins` to `preset.plugins` and shallow-merges `rules`.

## CLI

```
conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]
```

- `check` — Run conformance checks against the configured preset.
- `--path <dir>` — Target directory (default `process.cwd()`).
- `--json` — Machine-readable JSON via `renderJson` (mutually exclusive with `--group`; exit 1 if combined).
- `-v, --verbose` — Show `pass` results (default: only `warn`+`fail` are visible; summary counts always include all).
- `--group <mode>` — TUI grouping: `domains` (default, groups by `domain` then `files`) or `files` (groups by `files`).

Entry point is `src/cli/index.ts` (`commander`). Note `package.json` `bin.conform` declares `src/cli.ts` which does not exist; correct invocation is `bun run src/cli/index.ts check` (and `import.meta.dir` version read is `join(..,"package.json")` which resolves to `src/package.json`; it should be `../..`).

`src/cli/check.ts` flow: `loadConfig → resolver → mergepresetWithConfig → runChecks → exit code`. **`renderTui`/`renderJson` are not called today** — results only affect the exit code (see Gotchas).

Engine: `src/api/engine.ts` flattens `preset.plugins[].rules`, applies `RuleOverrides` (`off` skips, other severities coerce non-pass), awaits `rule.check(targetPath)`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules `pass` |
| 1 | One or more `fail` (takes priority) — also `--json`+`--group` misuse |
| 2 | `warn` only, **or** no `conform.config.ts`, **or** preset not found (`resolver` returns null) |

## TUI Output

`src/cli/reporter/tui.ts` — `renderTui(presetName, results, { verbose, groupBy })`. Pass hidden unless verbose; divider `━×50`; summary `N passed · N warned · N failed`.

```
@adistack/conform — package preset

Build & Tasks
  package.json
    ✓ structure          package.json structure ok
    ✗ entry-point        no main, module, or exports field defined

Dev Environment
  .husky
    ✗ hooks-dir          .husky/ directory not found

Style & Validation
  biome.json
    ✓ dev-deps           @biomejs/biome in devDependencies
    ⚠ config-file        no biome.json or biome.jsonc found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  12 passed  ·  3 warned  ·  5 failed
```

Actual grouping: `renderByDomains` (default) uses `Map<domain, Map<filesKey, RuleResult[]>>`; `renderByFiles` uses `Map<filesKey, RuleResult[]>`. No `✱` AI indicator — not implemented.

## JSON Output

`src/cli/reporter/json.ts` — `renderJson(presetName, targetPath, results, { verbose, groupBy })`. `visible` obeys `verbose`; `summary` always counts all; `groupBy` only emitted when `"files"`.

```json
{
  "preset": "package",
  "path": "/path/to/repo",
  "results": [
    { "id": "husky:dev-deps", "domain": "Dev Environment", "files": [], "description": "husky in devDependencies", "status": "fail", "message": "husky not found in devDependencies" }
  ],
  "summary": { "pass": 12, "warn": 3, "fail": 5 }
}
```

No `kind`/`confidence`/`reasoning`/`ai` fields — those belonged to a removed AI proposal (ADR 003 superseded).

## Package Preset — Rule Set

`src/presets/package.ts` is the only complete preset. 13 plugins, 40+ atomic rules (namespaced `pluginId:ruleId`). Short summary (see `src/plugins/*` for exact `test` logic and `Status` messages):

| Plugin (`id`) | Domain | Rule (`id`) | One-line |
|---|---|---|---|
| `package-json` | Build & Tasks / Security | `structure` | `name/version/license/type=module/bugs` required; `description/engines/homepage/repository/sideEffects` recommended |
| | | `entry-point` | `main|module|exports` present |
| | | `build-script` | `prepare|build` script |
| | | `files-or-npmignore` | `files` or `.npmignore` (warn) |
| | | `no-install-hooks` | no `preinstall/postinstall/install` (supply-chain) |
| `biome` | Style & Validation | `dev-deps` | `@biomejs/biome` in devDeps |
| | | `config-file` | `biome.json|.jsonc` (warn) |
| | | `lint-script` | `lint|check` runs biome |
| | | `format-script` | `format|check:format|check:lint` runs biome (warn) |
| `typescript` | Code Quality / Observability | `deps` | `typescript` in dev/peerDeps |
| | | `tsconfig` | `tsconfig.json` exists |
| | | `strict` | `strict:true` |
| | | `no-unchecked-indexed-access` | `noUncheckedIndexedAccess:true` |
| | | `isolated-modules` | `isolatedModules:true` |
| | | `verbatim-module-syntax` | `verbatimModuleSyntax:true` (warn) |
| | | `source-map` | `sourceMap:true` when not `noEmit` (warn) |
| `husky` | Dev Environment | `dev-deps` | `husky` devDep |
| | | `hooks-dir` | `.husky/` exists |
| | | `prepare-script` | `prepare` calls husky |
| | | `pre-commit` | `.husky/pre-commit` |
| | | `commit-msg` | `.husky/commit-msg` |
| `scripts` | Build & Tasks | `typecheck` | `typecheck|check:types|types` (warn) |
| | | `no-prepublish` | no deprecated `prepublish` |
| `bin` | Build & Tasks | `file-exists` | `bin` target exists |
| | | `shebang` | bin has shebang |
| `testing` | Testing | `test-runner` | vitest/bun test dep |
| | | `test-script` | `test` script |
| `jsr` | Build & Tasks | `jsr` | `jsr.json` fields |
| | | `no-slow-types` | `noSlowTypes` |
| | | `provenance` | `publishing.provenance` |
| `docs` | Documentation | `readme` | `README.md` |
| | | `readme-install` | install section |
| | | `readme-usage` | usage section |
| | | `has-description` | `package.json` description |
| | | `changelog` | `CHANGELOG.md` / changesets |
| `gitignore` | Dev Environment | `exists` | `.gitignore` |
| | | `node-modules` | ignores `node_modules` |
| | | `env` | ignores `.env*` |
| `github` | GitHub Configuration | `ci-workflow` | `.github/workflows/ci.yml` |
| | | `ci-lint` | CI runs lint |
| | | `ci-typecheck` | CI runs typecheck |
| | | `release-workflow` | `.github/workflows/release.yml` |
| | | `dependabot` | `dependabot.yml` |
| `github-config` | GitHub Configuration | `github` | `.github/` dir |
| | | `contributing` | `CONTRIBUTING.md` |
| | | `security-md` | `SECURITY.md` |
| | | `docs` | `docs/` |
| `files` | (varies) | `license` | `LICENSE` |
| | | `readme` | `README.md` |
| | | `gitignore` | `.gitignore` |

Other presets (`astro-site`, `monorepo`, `react-site`, `webapp`) are empty stubs (`plugins: []`). See `src/presets/*.ts`.

## Known Gotchas (verify before fixing — from AGENTS.md)

1. **Bin + version path broken:** `package.json` `bin.conform = src/cli.ts` missing; `src/cli/index.ts:11` reads `../package.json` (i.e. `src/package.json`). Should be `../../package.json`. `bun run src/cli/index.ts check` crashes with `ENOENT` before checks unless patched.
2. **Resolver mismatch:** looks in `presets/` (nonexistent); presets live in `src/presets/`. Fix: point resolver at `src/presets/` or add `presets/` shim.
3. **Reporters not wired:** `CheckCommand` computes `results` but never calls `renderTui`/`renderJson`; only exit code varies, no stdout. Add `process.stdout.write(renderTui(...))` / `renderJson(...)` branch.
4. **Docs drift:** `Target`/`CheckContext`, `RuleSet` old name, `presets/rules/` → now `src/plugins/`, `group` → `domain`+`files`, `kind`/`aiRule` never existed.
