# Architecture — @adistack/conform

Source of truth: `src/types.ts` + `src/api/*` + `src/utils/*` + `src/cli/*`. For terminology see `/CONTEXT.md`.

## Design Principles

1. **Presets are code** — TypeScript modules exporting a Preset, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it.
3. **Opinionated with oxc-style overrides** — `Preset.rules` and `ConformConfig.rules` are `StrictRuleOverrides`/`StrictPresetRules` (`{ level?: "warn"|"off"|"error", ...params }` with flattened params, `level` optional; `level` string alone also allowed). Severity `off` skips, any defined `warn`/`error`(`→fail`) coerces non-`pass` results (`pass` results never rewritten; `off` never reaches coercion). Unknown severity → fail-closed (`engine.ts:121` emits `fail` with `Invalid severity "…"`) . Params are flattened alongside `level` (no `params` key) and validated in `src/api/plugin.ts` (not engine). See Params & Overrides detail below.
4. **Atomic rules, grouped display** — Each check is one atomic Rule. TUI groups by `domain` then `files` (or by `files` with `--group files`). See ADR 002.
5. **Zero config from CLI — single-package or monorepo** — Preset selection lives in `conform.config.ts`. Single-package uses `defineConfig({ preset, plugins?, rules? })` (truthy `preset` check); monorepo uses `defineMonorepoConfig({ "<pkgDir>": ConformConfig, … })` detected via `isMonorepoConfig`. No `--preset` flag. Additional `plugins`/`rules` are merged via `mergePresetWithConfig` (`src/api/engine.ts:134`).
6. **Plugins own context** — `Plugin<T>` declares `id`+`context: (target: Target) => T`; each rule declares its own `domain` (required, no plugin-level default). Each rule receives `{ context: T, params? }` via `test`. All Rules must be defined via `Plugin#defineRule`; standalone `defineRule` does not exist. All FS access goes through `src/utils/fs.ts` (`Target`).

## Types (mirrors `src/types.ts`)

The global `RuleRegistry` is auto-inferred from the `@/plugins/index.ts` barrel — no hardcoded ID list. Per-preset `StrictPresetRules<Ps>` narrows further to the preset's own tuple.

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

export type AnyPlugin = Plugin<string, Record<string, unknown>>;
export interface Plugin<Id extends string = string, ParamMap extends Record<string, unknown> = Record<string, unknown>> {
  _paramMap: ParamMap; id: Id; rules: Rule<unknown>[];
}

export type RuleLevel = "warn" | "off" | "error";
export type RuleConfig<P = unknown> =
  P extends Record<string, unknown>
    ? RuleLevel | ({ level?: RuleLevel } & Partial<P>)
    : RuleLevel | ({ level?: RuleLevel } & Record<string, unknown>);
export type RuleOverrides = Record<string, RuleConfig<unknown>>;

// Auto-inferred registry — single source of truth via barrel
export type InferPluginParamMap<P> = P extends Plugin<string, infer M> ? M : never;
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type InferPresetParamMap<Ps extends readonly AnyPlugin[]> = UnionToIntersection<InferPluginParamMap<Ps[number]>>;
type _PluginModule = typeof import("@/plugins/index.ts");
type _BuiltinPluginUnion = { [K in keyof _PluginModule]: _PluginModule[K] extends AnyPlugin ? _PluginModule[K] : never }[keyof _PluginModule];
type AllBuiltinPlugins = readonly _BuiltinPluginUnion[];
export type RuleRegistry = InferPresetParamMap<AllBuiltinPlugins>; // e.g. "husky/hook" → HuskyHookSpec[], "package-json/required-fields" → {fields:string[]}, etc. — inferred, not hardcoded
export type StrictRuleConfig<K extends string> = K extends keyof RuleRegistry ? RuleConfig<RuleRegistry[K]> : RuleConfig<unknown>;
export type StrictRuleOverrides = { [K in keyof RuleRegistry]?: StrictRuleConfig<K> } & Record<string, RuleConfig<unknown>>;

// Per-preset locality — curried definePreset(plugins)(config) infers Ps as const
export type PresetRuleRegistry<Ps extends readonly AnyPlugin[]> = InferPresetParamMap<Ps>;
export type StrictPresetRules<Ps extends readonly AnyPlugin[]> = {
  [K in keyof PresetRuleRegistry<Ps>]?: RuleConfig<PresetRuleRegistry<Ps>[K]>;
} & { [K in string as K extends keyof PresetRuleRegistry<Ps> ? never : K]?: RuleConfig<unknown> };

export interface Preset { name: string; description: string; plugins: Plugin[]; rules?: StrictRuleOverrides; }
export interface PresetWithPlugins<Ps extends readonly AnyPlugin[]> { name: string; description: string; plugins: Ps; rules?: StrictPresetRules<Ps>; }

export interface RuleResult { id: string; domain: string; files: string[]; description: string; status: Severity; message?: string; }

export interface ConformConfig { preset: string; plugins?: Plugin[]; rules?: StrictRuleOverrides; }
export type MonorepoConfig = Record<string, ConformConfig>;

export interface ConformOutput {
  preset: string; path: string;
  results: RuleResult[]; // filtered by verbose
  summary: { pass: number; warn: number; fail: number };
  groupBy?: GroupBy;     // only "files" is emitted; "domains" is default
}
export interface MonorepoConformOutput { path: string; outputs: ConformOutput[]; summary: { pass: number; warn: number; fail: number }; }
export interface MonorepoPackageResult { path: string; output: ConformOutput; rendered: string; hasFail: boolean; hasWarn: boolean; }
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

Preset — curried (preferred, infers `StrictPresetRules<Ps>`) and object (compat) forms:

```ts
import { definePreset } from "@adistack/conform";
import { husky } from "@/plugins/husky.ts";

// curried — plugins captured first so rules is checked against their inferred param map
export default definePreset([husky] as const)({
  name: "package",
  description: "Conformance rules for publishing an NPM package",
  rules: { "package-json/files-or-npmignore": "warn" },
});

// object — equivalent, also infers Ps as const
export default definePreset({
  name: "package",
  description: "Conformance rules for publishing an NPM package",
  plugins: [husky] as const,
  rules: { "package-json/files-or-npmignore": "warn" },
});
```

`@/*` alias (`tsconfig.json:31`, `vitest.config.ts:8`) → `./src/*` must be used for cross-module imports. Public surface is `src/index.ts` / `src/api/index.ts` / `src/plugins/index.ts` (barrel for auto-inferred `RuleRegistry`). No deep imports like `src/plugins/biome.ts` from outside `src/`.

## Preset & Plugin Layout

```
src/presets/        — flat files, each default-exports a Preset
  package.ts        — complete preset (9 plugins, 37 rules)
src/plugins/        — one file per plugin + utils/ + barrel
  index.ts          — barrel re-exporting all 9 plugins (drives RuleRegistry inference)
  package_json.ts, biome.ts, tsconfig_json.ts, husky.ts, docs.ts, gitignore.ts, github.ts, zed.ts, bun.ts
  utils/domain.ts   — DOMAIN display strings ("Build & Tasks", "Code Quality", …)
  utils/markdown.ts, utils/package.ts, utils/workflows.ts — shared helpers
```

`src/api/preset.ts:6` (`presetResolver`) resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from repo root (`resolve(import.meta.dir,"..","..")` + `join(packageRoot,"src","presets")`); candidates are `existsSync`-filtered then tried sequentially with `isValidPreset` gating (`name:string` + `description:string` + `plugins:array` + optional `rules:object`; `description` is required). `src/utils/fs.ts:10` exposes `Target` plus `fileExists`, `readFile`, `readJson` (`JSON.parse` first, falls back to `stripJsonComments` for `//`/`/* */` on failure), `packageJson` (`readJson<PackageJson>("package.json")`), and `createTarget(path)`. `src/utils/config.ts:7` dynamic-imports `conform.config.ts` and requires truthy `config.preset` (`isConformConfig` → `preset: string>0`) else returns null (treated as `no-config`).

## Config File

Single-package — `conform.config.ts` in target repo:

```ts
import { defineConfig } from "@adistack/conform";
export default defineConfig({
  preset: "package",
  plugins: [myPlugin],                    // optional, appended to preset.plugins
  rules: { "biome/dev-deps": "error" },   // optional, shallow-merged over preset.rules
});
```

Monorepo — `conform.config.ts` at workspace root:

```ts
import { defineMonorepoConfig } from "@adistack/conform";
export default defineMonorepoConfig({
  "packages/app": { preset: "package" },
  "packages/lib": { preset: "package", rules: { "docs/changelog": "off" } },
  // keys are relative or absolute package dirs; values are ConformConfig
});
```

`loadConfig` (`src/utils/config.ts:7`) requires truthy `config.preset` (`isConformConfig`); missing/falsy → `no-config` error (exit 2). `isMonorepoConfig` (`src/api/config.ts:17`) validates `Record<string, ConformConfig>` with no top-level `preset` and non-empty. Monorepo resolution is `loadAndResolveMonorepo` (`src/utils/config.ts:98`): `loadRawConfig` → `isMonorepoConfig` → `expandWorkspaces(rootDir)` (from `package.json:workspaces` array or `{ packages }` via `Bun.Glob` + exact-path fallback, deduped, `package.json`-verified, sorted) → `resolveMonorepoPackages` (normalizes keys to absolute paths, throws `No workspaces field` / `No preset/rules defined for workspace package "…"` / `does not match any workspace package` / `Invalid ConformConfig`, returns ordered `Map<string, ConformConfig>`). Merging is in `src/api/engine.ts:134 mergePresetWithConfig` (shallow `plugins` append + `rules` spread; returns original ref if unchanged).

## CLI

```
conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]
```

- `--path <dir>` — Target directory (default `process.cwd()`).
- `--json` — Machine-readable JSON via `renderJson` (mutually exclusive with `--group`; misuse exits 1).
- `-v, --verbose` — Show `pass` results (default hides them; `summary` always counts all).
- `--group <mode>` — TUI grouping: `domains` (default) or `files` (no validation; unknown values fall through to `domains` via `src/cli/reporter/tui.ts:123`).

Entry is `src/cli/index.ts` (`commander`); `package.json:bin.conform` is `src/cli/index.ts`.

Flow: `src/cli/check.ts` → `check()` dispatch (`loadRawConfig` → if `isMonorepoConfig` → `checkMonorepo` else single-package `loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`) → `process.stdout.write(rendered)` → exit code. `checkMonorepo` iterates per-package `presetResolver`/`mergePresetWithConfig`/`buildPackageConformance`, aggregates summary, renders `MonorepoConformOutput` JSON or concatenated TUI blocks. Monorepo errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`) all exit 2.

Engine (`src/api/engine.ts:48-227`): flattens `preset.plugins[].rules`, parses override via `parseOverride`/`normalizeLevel` (`error`→`fail`, unknown → `null` fail-closed), rejects unknown severity as `fail` `Invalid severity "…"` without calling `check`, skips `off`, forwards flattened params (rest of override minus `level`) to `rule.check(targetPath, params?)`, coerces non-`pass` result via `coerceStatus`. Param validation lives in `src/api/plugin.ts:12 validateParams` inside the `Plugin.rules` getter wrapper (invalid → `fail` with `Invalid params: …` without calling `test`); engine does not validate. `level` is optional; `RuleLevel` string alone (`"off"` etc.) is also accepted.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules `pass` |
| 1 | One or more `fail` (takes priority over `warn`), **or** `--json`+`--group` misuse |
| 2 | `warn` only (no `fail`), **or** no `conform.config.ts` (`no-config`), **or** preset not found (`preset-not-found`), **or** monorepo config errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`) |

`hasFail` dominates `hasWarn` in `src/api/engine.ts:243` and `src/cli/check.ts:46`. Monorepo `checkMonorepo` maps thrown messages to codes: `No workspaces field` → `monorepo-no-workspaces`, `No preset/rules defined` → `monorepo-unconfigured-package`, `does not match any workspace` → `monorepo-extraneous-package`, else `monorepo-config-error` (`src/api/engine.ts:318`).

## TUI & JSON

`renderTui(presetName, results, { verbose, groupBy })` (`src/cli/reporter/tui.ts:30`) — `renderByDomains` (default) uses `Map<domain, Map<filesKey, RuleResult[]>>` preserving insertion order via `domainOrder[]`/`groupOrder[]`, `renderByFiles` uses `Map<filesKey, RuleResult[]>`. Keys are `files.join(", ")`. Header `@adistack/conform — ${preset} preset`, divider `━×50`, summary `N passed · N warned · N failed` (all counts from full `results`, not `visible`).

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

Monorepo — `checkMonorepo` (`src/api/engine.ts:309`):
- JSON: `MonorepoConformOutput { path, outputs: ConformOutput[], summary }` (per-package `groupBy` preserved; envelope mirrors `"files"` when requested).
- TUI: concatenated per-package blocks `━━ <absPath> (<preset>) ━━` + per-package TUI + `Summary: N passed · N warned · N failed across M packages`.

### Params & Overrides detail

- Rule may declare `params?: Type<P>` (arktype) via `Plugin#defineRule` (`src/api/plugin.ts:65`); materialized `Rule` exposes it as `paramsSchema`.
- Override is flat: `{ level?: RuleLevel, ...params }` or `RuleLevel` string alone. Engine takes rest of override minus `level` as `rawParams` via `parseOverride` (`src/api/engine.ts:85`); validation happens in the `Plugin.rules` wrapper via `validateParams` (`src/api/plugin.ts:12`) before `test()`. Invalid → `Status.fail("Invalid params: …")` without calling `test`. When `params` schema exists but `rawParams === undefined` (no extra keys beyond `level`), validation is skipped and `undefined` is forwarded (`plugin.ts:18`); when no schema exists, `rawParams` is forwarded unvalidated (`plugin.ts:16`). `level` is optional.
- Severity coercion (`src/api/engine.ts:74-132`): `normalizeLevel` maps `error`→`fail`, `off`→`off`, unknown string → `null` (fail-closed). Unknown severity does not coerce — engine emits `fail` with `Invalid severity "…" for rule "…"` without calling `check` (`engine.ts:185`). `off` skips the rule. Any defined override (`pass`/`warn`/`fail`/`error`→`fail`) coerces a non-`pass` result to that severity (`coerceStatus`); `pass` results are never rewritten regardless of override. This means `level: "pass"` (via coercion path) intentionally suppresses a `warn`/`fail` to `pass`. `pass` staying `pass` is the only invariant.

## Package Preset — Rule Set

`src/presets/package.ts` — 9 plugins, 37 rules (see `src/plugins/*` for exact messages). Every rule's `files` is `[]` except `husky/hook` which is `[".husky/pre-commit", ".husky/commit-msg"]` and a few content rules that declare their file (`biome/config-exists` etc.).

| Plugin | Domain | Rule | One-line |
|---|---|---|---|
| `package-json` | Build & Tasks | `structure` | `name/version/license/type=module/bugs` required; recommended `description/engines/homepage/repository/sideEffects` (warn) |
| | Build & Tasks | `entry-point` | `main\|module\|exports` present (`params: {fields?:string[]}`) |
| | Build & Tasks | `build-script` | `prepare\|build` script (`params: {scripts?:string[]}`) |
| | Build & Tasks | `files-or-npmignore` | `files` or `.npmignore` (warn) (`params: {file_expressions?:string[]}`) |
| | Security & Governance | `no-install-hooks` | no `preinstall/postinstall/install` (supply-chain) (`params: {scripts?:string[]}`) |
| | Build & Tasks | `required-fields` | `params: {fields:string[]}` — required `package.json` fields (preset: 12 fields) |
| | Build & Tasks | `typecheck` | `typecheck\|check:types\|types` script (warn) (`params: {scripts?:string[]}`) |
| | Build & Tasks | `no-prepublish` | no deprecated `prepublish` script (`params: {scripts?:string[]}`) |
| `biome` | Style & Validation | `dev-deps` | `@biomejs/biome` in devDeps |
| | Style & Validation | `config-exists` | `biome.json\|.jsonc` (fail) (`params: {file_expressions?:string[]}`) |
| | Style & Validation | `config` | `biome.json` matches repo config (fail) (`params: {config?:Record}`) |
| | Style & Validation | `lint-script` | `lint\|check` runs `biome` (`params: {file_expressions, contains}`) |
| | Style & Validation | `format-script` | `format\|check:format\|check:lint` runs `biome` (warn) |
| `typescript` | Code Quality | `deps` | `typescript` in dev/peerDeps |
| | Code Quality | `tsconfig` | `tsconfig.json` exists |
| | Code Quality | `compiler-options` | `tsconfig.json compilerOptions` matches repo config (`params: {compilerOptions?:Record}`) |
| `husky` | Dev Environment | `dev-deps` | `husky` in devDeps |
| | Dev Environment | `hooks-dir` | `.husky/` directory exists (`params: {file_expressions?:string[]}`) |
| | Dev Environment | `prepare-script` | `prepare` script calls `husky` (`params: {file_expressions, contains}`) |
| | Dev Environment | `hook` | `params: {hooks:{file,contains}[]}` — pre-commit `bun run format` + commit-msg `bun commitlint --edit "$1"` |
| `docs` | Documentation | `readme` | `README.md` exists and non-empty |
| | Documentation | `changelog` | `CHANGELOG.md` / `HISTORY.md` (warn) (`params: {file_expressions?:string[]}`) |
| | Documentation | `contributing` | `CONTRIBUTING.md` or `.github/CONTRIBUTING.md` (warn) |
| | Security & Governance | `license` | `LICENSE` / `LICENSE.md` / `LICENSE.txt` |
| | Security & Governance | `security-md` | `SECURITY.md` or `.github/SECURITY.md` (warn) |
| `gitignore` | Dev Environment | `exists` | `.gitignore` exists |
| | Dev Environment | `excludes` | `.gitignore` contains exclusion paths (`params: {file_expressions:string[]}`) — preset: `node_modules,.env*,*.env,*.gen.ts` |
| `github` | GitHub Configuration | `ci-workflow` | `.github/workflows/{ci,test,build,check}.{yml,yaml}` |
| | GitHub Configuration | `release-workflow` | `.github/workflows/{release,publish,deploy}.{yml,yaml}` (warn) |
| | GitHub Configuration | `ci-lint` | CI workflow runs `biome`/`lint` (warn) (`params: {file_expressions, contains}`) |
| | GitHub Configuration | `ci-typecheck` | CI workflow runs `tsc`/`typecheck` (warn) |
| | GitHub Configuration | `dependabot` | `dependabot.yml`/`yaml` or `renovate.json` (warn) |
| `zed` | Dev Environment | `dir` | `.zed/` directory exists (`params: {file_expressions?:string[]}`) |
| | Dev Environment | `settings-exists` | `.zed/settings.json` exists |
| | Dev Environment | `settings` | `.zed/settings.json` matches repo config (`params: {code_actions_on_format?, file_scan_exclusions?, …}`) |
| `bun` | Build & Tasks | `bunfig-exists` | `bunfig.toml` exists (`params: {file_expressions?:string[]}`) |
| | Build & Tasks | `bunfig-content` | `bunfig.toml` matches repo config (`params: {telemetry?, logLevel?, consoleDepth?, runBun?, …}`) |

Shipped preset overrides (`src/presets/package.ts:rules`): `husky/hook: { hooks: [{contains:"bun run format",file:".husky/pre-commit"},…] }` and `package-json/required-fields: { fields: ["license","name","author","contributors","repository","publishConfig","homepage","files","bugs","description","keywords","engines"] }` and `gitignore/excludes: { file_expressions: ["node_modules",".env*","*.env","*.gen.ts"] }` (all flattened, `level` omitted → no coercion). Generic example in §Preset above (`"package-json/files-or-npmignore": "warn"`) is illustrative only (`{ level: "warn" }` or `"warn"` both accepted).
