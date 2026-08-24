# Architecture — @adistack/conform

Source of truth: `src/types.ts` + `src/api/*`. For terminology see `/CONTEXT.md`.

## Design Principles

1. **Presets are code** — TypeScript modules exporting a Preset, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it.
3. **Opinionated with oxc-style overrides** — `Preset.rules` and `ConformConfig.rules` are `RuleOverrides`. Severity `off` skips, `warn`/`error`/`fail` coerce non-pass, `pass` keeps pass. Tuple `[severity, ...opts]` passes `opts[0]` as validated `params`.
4. **Atomic rules, grouped display** — Each check is one atomic Rule. TUI groups by `domain` then `files` (or by `files` with `--group files`). See ADR 002.
5. **Zero config from CLI** — Preset selection lives in `conform.config.ts` (`preset: string`). No `--preset` flag. Additional `plugins`/`rules` are merged there.
6. **Plugins own context** — `Plugin<T>` declares `context: (target: Target) => T`; each rule receives `{ context: T, params? }` via `test`. All Rules must be defined via `Plugin#defineRule`; standalone `defineRule` does not exist. All FS access goes through `src/utils/fs.ts` (`Target`).

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
export type RuleConfig<P = unknown> = RuleSeverity | [RuleSeverity, P, ...unknown[]];
export type RuleOverrides = Record<string, RuleConfig>;

// param-typed IDs
export interface HuskyHookSpec { file: string; contains: string }
export type RequiredFieldsParams = string[] | { fields: string[] };
export interface RuleRegistry {
  "husky:hook": HuskyHookSpec[];
  "package-json:required-fields": RequiredFieldsParams;
}
export type StrictRuleOverrides = {
  [K in keyof RuleRegistry]?: RuleConfig<RuleRegistry[K]>;
} & Record<string, RuleConfig>;

export interface Preset {
  name: string;
  description: string;
  plugins: Plugin[];
  rules?: StrictRuleOverrides; // typed overrides; underlying shape is RuleOverrides
}

export interface RuleResult {
  id: string; domain: string; files: string[];
  description: string; status: Severity; message?: string;
}

export interface ConformConfig { preset: string; plugins?: Plugin[]; rules?: StrictRuleOverrides; }

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
  domain: DOMAIN.DEV_ENVIRONMENT,
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
  domain: DOMAIN.DEV_ENVIRONMENT,
  name: "hook matches pattern",
  params: type({ pattern: "string" }),
  test({ context, params }) {
    // params is validated; engine returns fail with "Invalid params: …" if invalid
    return Status.pass();
  },
});
// preset or config override: rules: { "husky:hook-pattern": ["warn", { pattern: "*.sh" }] }
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
  package.ts        — complete preset (7 plugins, 36 rules)
src/plugins/        — one file per plugin + utils/
  package_json.ts, biome.ts, tsconfig.ts, husky.ts, docs.ts, gitignore.ts, github.ts
  utils/domain.ts   — DOMAIN display strings ("Build & Tasks", "Code Quality", …)
  utils/markdown.ts, utils/package.ts, utils/workflows.ts — shared helpers
```

`src/api/preset.ts` (`presetResolver`) resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from repo root (`join(import.meta.dir, "../..", "src/presets")`). `src/utils/fs.ts` exposes `Target` plus `fileExists`, `readFile`, `readJson` (strips `//`/`/* */`), `packageJson`. `src/utils/config.ts` dynamic-imports `conform.config.ts` and requires `config.preset: string` else returns null (treated as `no-config`).

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

Entry is `src/cli/index.ts` (`commander`); `package.json:bin.conform` is `src/cli/index.ts`.

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

- Rule may declare `params?: Type<P>` (arktype) via `Plugin#defineRule`.
- Override tuple is `[RuleSeverity, paramsValue]`. Engine takes `rawOverride[1]` as `rawParams`, validates against `paramsSchema` before `test()` via `validateParams` (`src/api/validate.ts`). Invalid → `Status.fail("Invalid params: …")` without calling `test`.
- Severity coercion: if override is `warn`/`fail`/`error` and result is `warn`/`fail`, status is rewritten to override. `pass` is never coerced. `off` skips the rule entirely. All Rules are plugin-owned; standalone `defineRule` does not exist.

## Package Preset — Rule Set

`src/presets/package.ts` — 7 plugins, 36 rules (see `src/plugins/*` for exact messages). Every rule's `files` is `[]` except `husky:hook` which is `[".husky/pre-commit", ".husky/commit-msg"]`.

| Plugin | Domain | Rule | One-line |
|---|---|---|---|
| `package-json` | Build & Tasks | `structure` | `name/version/license/type=module/bugs` required; recommended `description/engines/homepage/repository/sideEffects` (warn) |
| | Build & Tasks | `entry-point` | `main\|module\|exports` present |
| | Build & Tasks | `build-script` | `prepare\|build` script |
| | Build & Tasks | `files-or-npmignore` | `files` or `.npmignore` (warn) |
| | Security & Governance | `no-install-hooks` | no `preinstall/postinstall/install` (supply-chain) |
| | Build & Tasks | `required-fields` | `params: string[] \| {fields:string[]}` — required `package.json` fields (default via `DEFAULT_REQUIRED_PACKAGE_FIELDS`) |
| | Build & Tasks | `typecheck` | `typecheck\|check:types\|types` script (warn) |
| | Build & Tasks | `no-prepublish` | no deprecated `prepublish` script |
| `biome` | Style & Validation | `dev-deps` | `@biomejs/biome` in devDeps |
| | Style & Validation | `config-file` | `biome.json\|.jsonc` (warn) |
| | Style & Validation | `lint-script` | `lint\|check` runs `biome` |
| | Style & Validation | `format-script` | `format\|check:format\|check:lint` runs `biome` (warn) |
| `typescript` | Code Quality | `deps` | `typescript` in dev/peerDeps |
| | Code Quality | `tsconfig` | `tsconfig.json` exists |
| | Code Quality | `strict` | `strict:true` |
| | Code Quality | `no-unchecked-indexed-access` | `noUncheckedIndexedAccess:true` |
| | Code Quality | `isolated-modules` | `isolatedModules:true` |
| | Code Quality | `verbatim-module-syntax` | `verbatimModuleSyntax:true` (warn) |
| | Observability | `source-map` | `sourceMap:true` when not `noEmit` (warn) |
| `husky` | Dev Environment | `dev-deps` | `husky` in devDeps |
| | Dev Environment | `hooks-dir` | `.husky/` directory exists |
| | Dev Environment | `prepare-script` | `prepare` script calls `husky` |
| | Dev Environment | `hook` | `params: HuskyHookSpec[]` (`{file, contains}[]`), defaults to pre-commit `bun run format` + commit-msg `bun commitlint --edit "$1"` |
| `docs` | Documentation | `readme` | `README.md` exists and non-empty |
| | Documentation | `changelog` | `CHANGELOG.md` / `HISTORY.md` (warn) |
| | Documentation | `contributing` | `CONTRIBUTING.md` or `.github/CONTRIBUTING.md` (warn) |
| | Security & Governance | `license` | `LICENSE` / `LICENSE.md` / `LICENSE.txt` |
| | Security & Governance | `security-md` | `SECURITY.md` or `.github/SECURITY.md` (warn) |
| `gitignore` | Dev Environment | `exists` | `.gitignore` exists |
| | Dev Environment | `node-modules` | `.gitignore` contains `node_modules` |
| | Dev Environment | `env` | `.gitignore` contains `.env` / `.env*` |
| `github` | GitHub Configuration | `ci-workflow` | `.github/workflows/{ci,test,build,check}.{yml,yaml}` |
| | GitHub Configuration | `release-workflow` | `.github/workflows/{release,publish,deploy}.{yml,yaml}` (warn) |
| | GitHub Configuration | `ci-lint` | CI workflow runs `biome`/`lint` (warn) |
| | GitHub Configuration | `ci-typecheck` | CI workflow runs `tsc`/`typecheck` (warn) |
| | GitHub Configuration | `dependabot` | `dependabot.yml`/`yaml` or `renovate.json` (warn) |

Shipped preset overrides (`src/presets/package.ts:rules`): `husky:hook: ["error", [{contains:"bun run format",file:".husky/pre-commit"},…]]` and `package-json:required-fields: ["error", ["license","name","author","contributors","repository"]]` (both `error`→`fail`). Generic example in §Preset above (`"package-json:files-or-npmignore": "warn"`) is illustrative only.
