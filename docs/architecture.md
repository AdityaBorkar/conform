# Architecture — @adistack/conform

Source of truth: `src/types.ts` + `src/api/*` + `src/utils/*` + `src/cli/*`. For terminology see `/CONTEXT.md`.

## Design Principles

1. **Presets are code** — TypeScript modules exporting a Preset, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it.
3. **Opinionated with oxc-style overrides** — `Preset.rules` and `ConformConfig.rules` are `StrictRuleOverrides`/`RuleOverrides` (`{ level?: "warn"|"off"|"error", ...params }` with flattened params, `level` optional; `level` string alone also allowed). Severity `off` skips, any defined `warn`/`error`(`→fail`) coerces non-`pass` results (`pass` results never rewritten; `off` never reaches coercion). Unknown severity → fail-closed (`engine.ts:120` emits `fail` with `Invalid severity "…"`) . Params are flattened alongside `level` (no `params` key) and validated in `src/api/plugin.ts` (not engine). See Params & Overrides detail below.
4. **Atomic rules, grouped display** — Each check is one atomic Rule. TUI groups by `domain` then `files` (or by `files` with `--group files`). See ADR 002.
5. **Zero config from CLI** — Preset selection lives in `conform.config.ts` (`preset: string`, truthy check). No `--preset` flag. Additional `plugins`/`rules` are merged via `mergePresetWithConfig` (`src/api/engine.ts:80`).
6. **Plugins own context** — `Plugin<T>` declares `id`+`context: (target: Target) => T`; each rule declares its own `domain` (required, no plugin-level default). Each rule receives `{ context: T, params? }` via `test`. All Rules must be defined via `Plugin#defineRule`; standalone `defineRule` does not exist. All FS access goes through `src/utils/fs.ts` (`Target`).

## Types (mirrors `src/types.ts`)

```ts
export type Severity = "pass" | "warn" | "fail";
export type GroupBy = "domains" | "files";

export interface CheckResult { status: Severity; message?: string }

export interface Rule<P = unknown> {
  id: string;            // namespaced as `pluginId/ruleId` when via Plugin
  domain: string;        // e.g. DOMAIN.BUILD = "Build & Tasks"
  files: string[];
  description: string;   // authoring uses `name` (Plugin#defineRule) → materialized as `description`
  check: (ctx: string, params?: P) => CheckResult | Promise<CheckResult>; // authoring uses `test({context, params?})`
  paramsSchema?: import("arktype").Type; // authoring uses `params: Type<P>`
}

export interface Plugin { id: string; rules: Rule[] } // impl: class Plugin<T> { context:(Target)=>T, defineRule }

export type RuleLevel = "warn" | "off" | "error";
export type RuleConfig<P = unknown> = P extends Record<string, unknown>
  ? RuleLevel | ({ level?: RuleLevel } & Partial<P>)
  : RuleLevel | ({ level?: RuleLevel } & Record<string, unknown>);
export type RuleOverrides = Record<string, RuleConfig>;

// param-typed IDs
export interface HuskyHookSpec { file: string; contains: string }
export type RequiredFieldsParams = string[] | { fields: string[] };
export interface RuleRegistry {
  "husky/hook": HuskyHookSpec[];
  "package-json/required-fields": RequiredFieldsParams;
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
import { definePlugin, DOMAIN, Status } from "@adistack/conform";
import { fileExists, packageJson } from "@/utils/fs.ts";

export const husky = definePlugin({
  id: "husky",
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
// preset or config override: rules: { "husky/hook-pattern": { level: "warn", pattern: "*.sh" } } // or { pattern: "*.sh" } with level omitted
```

Preset:

```ts
import { definePreset } from "@adistack/conform";
import { husky } from "@/plugins/husky.ts";
export default definePreset({
  name: "package",
  description: "Conformance rules for publishing an NPM package",
  plugins: [husky],
  rules: { "package-json/files-or-npmignore": "warn" },
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

`src/api/preset.ts:6-7` (`presetResolver`) resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from repo root (`resolve(import.meta.dir,"..","..")` + `join(packageRoot,"src","presets")`); candidates are `existsSync`-filtered then tried sequentially with `isValidPreset` gating (`name:string` + `plugins:array` + optional `rules:object`; `description` not validated). `src/utils/fs.ts:10` exposes `Target` plus `fileExists`, `readFile`, `readJson` (`JSON.parse` first, falls back to `stripJsonComments` for `//`/`/* */` on failure), `packageJson`. `src/utils/config.ts:8` dynamic-imports `conform.config.ts` and requires truthy `config.preset` else returns null (treated as `no-config`).

## Config File

```ts
// conform.config.ts in target repo
import { defineConfig } from "@adistack/conform";
export default defineConfig({
  preset: "package",
  plugins: [myPlugin],                    // optional, appended to preset.plugins
  rules: { "biome/dev-deps": "error" },   // optional, shallow-merged over preset.rules
});
```

`loadConfig` (`src/utils/config.ts:12`) requires truthy `config.preset`; missing/falsy → `no-config` error (exit 2). Merging is in `src/api/engine.ts:80 mergePresetWithConfig` (shallow `plugins` append + `rules` spread; returns original ref if unchanged).

## CLI

```
conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]
```

- `--path <dir>` — Target directory (default `process.cwd()`).
- `--json` — Machine-readable JSON via `renderJson` (mutually exclusive with `--group`; misuse exits 1).
- `-v, --verbose` — Show `pass` results (default hides them; `summary` always counts all).
- `--group <mode>` — TUI grouping: `domains` (default) or `files` (no validation; unknown values fall through to `domains` via `src/cli/reporter/tui.ts:122`).

Entry is `src/cli/index.ts` (`commander`); `package.json:bin.conform` is `src/cli/index.ts`.

Flow: `src/cli/check.ts` → `check()` (`loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`) → `process.stdout.write(rendered)` → exit code.

Engine (`src/api/engine.ts:38-160`): flattens `preset.plugins[].rules`, parses override via `parseOverride`/`normalizeSeverity` (`error`→`fail`, unknown → `null` fail-closed), rejects unknown severity as `fail` `Invalid severity "…"`, skips `off`, forwards flattened params (rest of override minus `level`) to `rule.check(targetPath, params?)`, coerces non-`pass` result via `coerceStatus`. Param validation lives in `src/api/plugin.ts:12 validateParams` inside the `Plugin.rules` getter wrapper (invalid → `fail` with `Invalid params: …` without calling `test`); engine does not validate. `level` is optional; `RuleLevel` string alone (`"off"` etc.) is also accepted.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules `pass` |
| 1 | One or more `fail` (takes priority over `warn`), **or** `--json`+`--group` misuse |
| 2 | `warn` only (no `fail`), **or** no `conform.config.ts` (`no-config`), **or** preset not found |

`hasFail` dominates `hasWarn` in `src/api/engine.ts:180` and `src/cli/check.ts:46`.

## TUI & JSON

`renderTui(presetName, results, { verbose, groupBy })` (`src/cli/reporter/tui.ts:30-137`) — `renderByDomains` (default) uses `Map<domain, Map<filesKey, RuleResult[]>>` preserving insertion order via `domainOrder[]`/`groupOrder[]`, `renderByFiles` uses `Map<filesKey, RuleResult[]>`. Keys are `files.join(", ")`. Header `@adistack/conform — ${preset} preset`, divider `━×50`, summary `N passed · N warned · N failed` (all counts from full `results`, not `visible`).

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
  "results": [{ "id": "husky/dev-deps", "domain": "Dev Environment", "files": [], "description": "husky in devDependencies", "status": "fail", "message": "…" }],
  "summary": { "pass": 12, "warn": 3, "fail": 5 }
}
```

### Params & Overrides detail

- Rule may declare `params?: Type<P>` (arktype) via `Plugin#defineRule` (`src/api/plugin.ts:65-77`); materialized `Rule` exposes it as `paramsSchema`.
- Override is flat: `{ level?: RuleLevel, ...params }` or `RuleLevel` string alone. Engine takes rest of override minus `level` as `rawParams` via `parseOverride` (`src/api/engine.ts:57-68`); validation happens in the `Plugin.rules` wrapper via `validateParams` (`src/api/plugin.ts:12`) before `test()`. Invalid → `Status.fail("Invalid params: …")` without calling `test`. When `params` schema exists but `rawParams === undefined` (no extra keys beyond `level`), validation is skipped and `undefined` is forwarded (`plugin.ts:18-20`); when no schema exists, `rawParams` is forwarded unvalidated (`plugin.ts:16-17`). `level` is optional.
- Severity coercion (`src/api/engine.ts:38-78`): `normalizeSeverity` maps `error`→`fail`, `off`→`off`, unknown string → `null` (fail-closed). Unknown severity does not coerce — engine emits `fail` with `Invalid severity "…" for rule "…"` without calling `check` (`engine.ts:121-135`). `off` skips the rule. Any defined override (`pass`/`warn`/`fail`/`error`→`fail`) coerces a non-`pass` result to that severity (`coerceStatus`); `pass` results are never rewritten regardless of override. This means `["pass", …]` or `"pass"` intentionally suppresses a `warn`/`fail` to `pass`. `pass` staying `pass` is the only invariant.

## Package Preset — Rule Set

`src/presets/package.ts` — 7 plugins, 36 rules (see `src/plugins/*` for exact messages). Every rule's `files` is `[]` except `husky/hook` which is `[".husky/pre-commit", ".husky/commit-msg"]`.

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

Shipped preset overrides (`src/presets/package.ts:rules`): `husky/hook: { level: "error", hooks: [{contains:"bun run format",file:".husky/pre-commit"},…] }` and `package-json/required-fields: { level: "error", fields: ["license","name","author","contributors","repository"] }` (both `error`→`fail`); `gitignore/excludes: { level: "error", file_expressions: ["node_modules",".env"] }`. Generic example in §Preset above (`"package-json/files-or-npmignore": "warn"`) is illustrative only (`{ level: "warn" }` or `"warn"` both accepted).
