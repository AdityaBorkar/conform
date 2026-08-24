# Architecture — @adistack/conform

Source of truth: `src/types.ts` + `src/api/*`. For terminology see `/CONTEXT.md`.

## Design Principles

1. **Presets are code** — TypeScript modules exporting a Preset, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it.
3. **Opinionated with oxc-style overrides** — `Preset.rules` and `ConformConfig.rules` are `RuleOverrides`. Severity `off` skips, `warn`/`error`/`fail` coerce non-pass, `pass` keeps pass. Tuple `[severity, ...opts]` passes `opts[0]` as validated `params`.
4. **Atomic rules, grouped display** — Each check is one atomic Rule. TUI groups by `domain` then `files` (or by `files` with `--group files`). See ADR 002.
5. **Zero config from CLI** — Preset selection lives in `conform.config.ts` (`preset: string`). No `--preset` flag. Additional `plugins`/`rules` are merged there.
6. **Plugins own context** — `Plugin<T>` declares `context: (target: Target | string) => T`; each rule receives `{ context: T, params? }` via `test`. Standalone rules (`defineRule`) receive `targetPath: string` directly. All FS access goes through `src/utils/fs.ts`.

## Types (mirrors `src/types.ts`)

```ts
export type Severity = "pass" | "warn" | "fail";
export type GroupBy = "domains" | "files";

export interface CheckResult { status: Severity; message?: string }

export interface Rule<P = unknown> {
  id: string;            // namespaced as `pluginId:ruleId` when via Plugin
  domain: string;        // e.g. DOMAIN.BUILD = "Build & Tasks"
  files: string[];
  description: string;
  check: (ctx: string, params?: P) => CheckResult | Promise<CheckResult>;
  paramsSchema?: import("arktype").Type;
}

export interface Plugin { id: string; rules: Rule[] }

export type RuleSeverity = Severity | "off" | "error"; // "error" → "fail"
export type RuleConfig = RuleSeverity | [RuleSeverity, ...unknown[]];
export type RuleOverrides = Record<string, RuleConfig>;

export interface Preset {
  name: string;
  description: string;
  plugins: Plugin[];
  rules?: RuleOverrides;
}

export interface RuleResult {
  id: string; domain: string; files: string[];
  description: string; status: Severity; message?: string;
}

export interface ConformConfig { preset: string; plugins?: Plugin[]; rules?: RuleOverrides; }

export interface ConformOutput {
  preset: string; path: string;
  results: RuleResult[]; // filtered by verbose
  summary: { pass: number; warn: number; fail: number };
  groupBy?: GroupBy;     // only "files" is emitted; "domains" is default
}
```

## Plugin & Rule Authoring

Preferred — `definePlugin` / `Plugin`:

```ts
import { definePlugin, Status } from "@adistack/conform";
import { fileExists, packageJson } from "@/utils/fs.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";

export const husky = definePlugin({
  id: "husky",
  domain: DOMAIN.DEV_ENVIRONMENT,
  context: (target) => ({
    fileExists: (p: string) => fileExists(target, p),
    packageJson: () => packageJson(target),
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

With params (arktype validated):

```ts
import { type } from "arktype";
husky.defineRule({
  id: "hook-pattern",
  name: "hook matches pattern",
  params: type({ pattern: "string" }),
  test({ context, params }) {
    // params is validated; engine returns fail with "Invalid params: …" if invalid
    return Status.pass();
  },
});
// preset or config override: rules: { "husky:hook-pattern": ["warn", { pattern: "*.sh" }] }
```

Standalone:

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

Preset:

```ts
import { definePreset } from "@adistack/conform";
import { husky } from "@/plugins/husky.ts";
export default definePreset({
  name: "package",
  description: "Conformance rules for publishing an NPM package",
  plugins: [husky],
  rules: { "package-json:files-or-npmignore": "warn" },
});
```

## Preset & Plugin Layout

```
src/presets/        — flat files, each default-exports a Preset
  package.ts        — only complete preset (13 plugins); astro-site/monorepo/react-site/webapp are stubs
src/plugins/        — one file per plugin + utils/domain.ts
  package_json.ts, biome.ts, tsconfig.ts, husky.ts, scripts.ts, bin.ts,
  testing.ts, jsr.ts, docs.ts, gitignore.ts, github.ts, github-config.ts, files.ts
  utils/domain.ts   — DOMAIN display strings
```

`src/api/preset.ts` resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` at repo root. `src/utils/fs.ts` exposes `fileExists`, `readFile`, `readJson` (strips `//`/`/* */`), `packageJson`. `src/utils/config.ts` dynamic-imports `conform.config.ts`.

## Config File

```ts
// conform.config.ts in target repo
import { defineConfig } from "@adistack/conform";
export default defineConfig({
  preset: "package",
  plugins: [myPlugin],                    // optional, appended to preset.plugins
  rules: { "biome:dev-deps": "error" },   // optional, shallow-merged over preset.rules
});
```

`loadConfig` requires `config.preset: string`; missing/invalid → `no-config` error (exit 2). Merging is in `src/api/conformance.ts:mergePresetWithConfig`.

## CLI

```
conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]
```

- `--path <dir>` — Target directory (default `process.cwd()`).
- `--json` — Machine-readable JSON via `renderJson` (mutually exclusive with `--group`; misuse exits 1).
- `-v, --verbose` — Show `pass` results (default hides them; `summary` always counts all).
- `--group <mode>` — TUI grouping: `domains` (default) or `files`.

Entry is `src/cli/index.ts` (`commander`); `package.json:bin.conform` is `src/cli.ts`.

Flow: `src/cli/check.ts` → `check()` (`loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`) → `process.stdout.write(rendered)` → exit code.

Engine (`src/api/engine.ts`): flattens `preset.plugins[].rules`, normalizes severity (`error`→`fail`), skips `off`, validates `params` via arktype (invalid → `fail` with `Invalid params: …`), coerces non-pass status to override, calls `rule.check(targetPath, params?)`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules `pass` |
| 1 | One or more `fail` (takes priority over `warn`), **or** `--json`+`--group` misuse |
| 2 | `warn` only (no `fail`), **or** no `conform.config.ts` (`no-config`), **or** preset not found |

`hasFail` dominates `hasWarn` in `src/api/conformance.ts` and `src/cli/check.ts`.

## TUI & JSON

`renderTui(presetName, results, { verbose, groupBy })` — `renderByDomains` (default) uses `Map<domain, Map<filesKey, RuleResult[]>>`, `renderByFiles` uses `Map<filesKey, RuleResult[]>`. Summary `N passed · N warned · N failed`.

```
@adistack/conform — package preset

Build & Tasks
  package.json
    ✓ structure          package.json structure ok
    ✗ entry-point        no main, module, or exports field defined
```

`renderJson(presetName, targetPath, results, { verbose, groupBy })` emits `ConformOutput`; `visible` obeys `verbose`; `groupBy` only emitted when `"files"`.

```json
{
  "preset": "package",
  "path": "/path/to/repo",
  "results": [{ "id": "husky:dev-deps", "domain": "Dev Environment", "files": [], "description": "husky in devDependencies", "status": "fail", "message": "…" }],
  "summary": { "pass": 12, "warn": 3, "fail": 5 }
}
```

### Params & Overrides detail

- Rule may declare `params?: Type<P>` (arktype). `Plugin.defineRule` and `defineRule` both support it.
- Override tuple is `[RuleSeverity, paramsValue]`. Engine takes `rawOverride[1]` as `rawParams`, validates against `paramsSchema` before `test()`. Invalid → `Status.fail("Invalid params: …")` without calling `test`.
- Severity coercion: if override is `warn`/`fail`/`error` and result is `warn`/`fail`, status is rewritten to override. `pass` is never coerced. `off` skips the rule entirely.

## Package Preset — Rule Set

`src/presets/package.ts` — 13 plugins, 40+ rules (see `src/plugins/*` for exact messages):

| Plugin | Domain | Rule | One-line |
|---|---|---|---|
| `package-json` | Build/Security | `structure` | `name/version/license/type=module/bugs` required |
| | | `entry-point` | `main\|module\|exports` present |
| | | `build-script` | `prepare\|build` script |
| | | `files-or-npmignore` | `files` or `.npmignore` (warn) |
| | | `no-install-hooks` | no `preinstall/postinstall/install` |
| `biome` | Style | `dev-deps` | `@biomejs/biome` in devDeps |
| | | `config-file` | `biome.json\|.jsonc` (warn) |
| | | `lint-script` | `lint\|check` runs biome |
| | | `format-script` | `format\|check:format\|check:lint` runs biome (warn) |
| `typescript` | Code Quality | `deps` | `typescript` in deps |
| | | `tsconfig` | `tsconfig.json` exists |
| | | `strict` | `strict:true` |
| | | `no-unchecked-indexed-access` | `noUncheckedIndexedAccess:true` |
| | | `isolated-modules` | `isolatedModules:true` |
| | | `verbatim-module-syntax` | `verbatimModuleSyntax:true` (warn) |
| | | `source-map` | `sourceMap:true` when not `noEmit` (warn) |
| `husky` | Dev Env | `dev-deps`/`hooks-dir`/`prepare-script`/`pre-commit`/`commit-msg` | husky wiring |
| `scripts` | Build | `typecheck`/`no-prepublish` | typecheck script, no deprecated prepublish |
| `bin` | Build | `file-exists`/`shebang` | bin target & shebang |
| `testing` | Testing | `test-runner`/`test-script` | vitest/bun test |
| `jsr` | Build | `jsr`/`no-slow-types`/`provenance` | jsr.json |
| `docs` | Docs | `readme`/`readme-install`/`readme-usage`/`has-description`/`changelog` | docs |
| `gitignore` | Dev Env | `exists`/`node-modules`/`env` | gitignore |
| `github` | GitHub | `ci-workflow`/`ci-lint`/`ci-typecheck`/`release-workflow`/`dependabot` | workflows |
| `github-config` | GitHub | `github`/`contributing`/`security-md`/`docs` | repo config |
| `files` | varies | `license`/`readme`/`gitignore` | top-level files |

Other presets (`astro-site`, `monorepo`, `react-site`, `webapp`) are stubs.
