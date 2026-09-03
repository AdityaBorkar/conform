# Architecture — @adistack/conform

Source of truth: `src/types.ts` + `src/api/*` + `src/utils/*` + `src/cli/*`. For terminology see `/CONTEXT.md`.

## Design Principles

1. **Presets are code** — TypeScript modules exporting a Preset, not YAML/data files. Rules can inspect anything on disk.
2. **Check-only, no auto-fix** — Report drift. Humans fix it.
3. **Opinionated with oxc-style overrides** — `Preset.rules` and `ConformConfig.rules` accept a `RuleLevel` string (`warn`/`off`/`error`) or a flat object `{ level?, ...params }` with `level` optional and no `params` wrapper. `off` skips, `error` maps to `fail`, `pass` results are never rewritten. Unknown severity strings fail closed without calling the rule. Params are validated against the rule's arktype schema before `test` runs.
4. **Atomic rules, grouped display** — Each check is one atomic Rule. TUI groups by `domain` then `files` by default, or by `files` with `--group files`. See ADR 002.
5. **Zero config from CLI — single-package or monorepo** — Preset selection lives in `conform.config.ts`. Single-package uses `defineConfig({ preset, plugins?, rules? })`; monorepo uses `defineMonorepoConfig({ "<pkgDir>": ConformConfig, … })` detected via `isMonorepoConfig`. No `--preset` flag. Additional `plugins`/`rules` merge via `mergePresetWithConfig` in `src/api/engine.ts`.
6. **Plugins own context** — `Plugin` declares `id` + `context: (target: Target) => T`; each rule declares its own `domain` (required, no plugin-level default). Authoring uses `test({ context, params? })`; the materialized runtime `Rule` exposes `check(targetPath, params?)`. All FS access goes through `src/utils/fs.ts` (`Target`).

## Types (see `src/types.ts`)

The global `RuleRegistry` is auto-inferred from the `#/plugins/index.ts` barrel — no hardcoded ID list. Per-preset `StrictPresetRules<Ps>` narrows further to the preset's own tuple.

```ts
export type Severity = "pass" | "warn" | "fail";
export type GroupBy = "domains" | "files";
export type RuleLevel = "warn" | "off" | "error";
export type RuleConfig<P = unknown> =
  P extends Record<string, unknown>
    ? RuleLevel | ({ level?: RuleLevel } & Partial<P>)
    : RuleLevel | ({ level?: RuleLevel } & Record<string, unknown>);
export type RuleOverrides = Record<string, RuleConfig<unknown>>;
export interface Rule<P = unknown> {
  id: string;            // namespaced as `pluginId/ruleId` via Plugin
  domain: string;        // e.g. DOMAIN.BUILD = "Build & Tasks"
  files: string[];
  description: string;   // authoring field `name` → materialized `description`
  check: (ctx: string, params?: P) => CheckResult | Promise<CheckResult>;
  paramsSchema?: import("arktype").Type; // authoring field `params`
}
export interface ConformConfig { preset: string; plugins?: Plugin[]; rules?: StrictRuleOverrides; }
export type MonorepoConfig = Record<string, ConformConfig>;
export interface ConformOutput {
  preset: string; path: string;
  results: RuleResult[]; // filtered by verbose
  summary: { pass: number; warn: number; fail: number };
  groupBy?: GroupBy;     // only "files" is emitted; "domains" is default
}
export interface MonorepoConformOutput { path: string; outputs: ConformOutput[]; summary: { pass: number; warn: number; fail: number }; }
```

`Preset`, `PresetWithPlugins`, `RuleResult`, `CheckResult`, `Plugin`, `StrictRuleOverrides`, `StrictPresetRules`, `RuleRegistry`, and `ConformanceErrorCode` are also defined in `src/types.ts` / `src/api/engine.ts`. `AutoRuleRegistry` is kept for backward compatibility; prefer `StrictPresetRules<Ps>`.

## Plugin & Rule Authoring

Preferred — `definePlugin` / `Plugin`:

```ts
import { definePlugin, DOMAIN, Status } from "@adistack/conform";

export const husky = definePlugin({
  id: "husky",
  context: (target) => ({
    fileExists: (p: string) => target.fileExists(p),
    packageJson: () => target.packageJson(),
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
// override: rules: { "husky/hook-pattern": { level: "warn", pattern: "*.sh" } }
// or { pattern: "*.sh" } with level omitted, or "husky/hook-pattern": "warn"
```

Authoring (`Plugin#defineRule`) uses `name` + `test({ context: T, params? })`; runtime (`Rule`) materializes `description` + `check(targetPath: string, params?)`. The `Plugin.rules` getter builds the `Target`, runs `context(target)`, validates params, then calls `test`. IDs materialize as `pluginId/ruleId`.

Preset — curried (preferred, infers `StrictPresetRules<Ps>`) and object (compat) forms:

```ts
import { definePreset } from "@adistack/conform";
import { husky } from "#/plugins/husky.ts";

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

`#/*` alias (`tsconfig.json`, `vitest.config.ts`) → `./src/*` must be used for cross-module imports. Public surface is `src/index.ts` / `src/api/index.ts` / `src/plugins/index.ts` barrel (drives `RuleRegistry` inference). Package also exposes `./plugins` → `./src/plugins/index.ts`. No deep imports like `src/plugins/biome.ts` from outside `src/`.

## Preset & Plugin Layout

```
src/presets/        — flat files, each default-exports a Preset
  package.ts        — complete preset (9 plugins, 62 rules)
src/plugins/        — one file per plugin + utils/ + barrel + github/ split
  index.ts          — barrel re-exporting all 9 plugins (drives RuleRegistry inference)
  package_json.ts (8), biome.ts (5), tsconfig_json.ts (3), husky.ts (4),
  docs.ts (5), gitignore.ts (2), github.ts (30 via github/ submodules),
  zed.ts (3), bun.ts (2)
  github/           — actions.ts (5), general.ts (13), review.ts (2),
                      security.ts (5), workflows.ts (5) + api.ts, context.ts, schemas.ts
  utils/domain.ts   — DOMAIN display strings
  utils/package.ts  — shared package helpers
src/api/            — engine.ts, plugin.ts, preset.ts, config.ts, status.ts, index.ts
src/utils/          — fs.ts (Target), config.ts (loadConfig/loadRawConfig/monorepo),
                      workspaces.ts (expandWorkspaces/getWorkspacesPatterns)
src/cli/            — index.ts (commander), check.ts,
                      reporter/tui.ts, reporter/json.ts
```

`src/api/preset.ts` (`presetResolver`) resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from the package root, filters candidates by existence, then gates on `isValidPreset` (`name:string` + `description:string` + `plugins:array` + optional `rules:object`). `src/utils/fs.ts` exposes `Target` plus `fileExists`, `readFile`, `readJson` (`JSON.parse` first, falls back to stripping `//`/`/* */` comments on failure), `packageJson`, and `createTarget(path)`. `src/utils/config.ts` dynamic-imports `conform.config.ts`; `isConformConfig` requires `preset: string>0`, else treated as `no-config`. `github` plugin context (`src/plugins/github/context.ts`) resolves owner/repo from `package.json:repository` or `.git/config` origin.

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

`loadConfig` requires a valid `ConformConfig`; missing/falsy → `no-config` error (exit 2). `isMonorepoConfig` (`src/api/config.ts`) validates `Record<string, ConformConfig>` with no top-level `preset` and non-empty. Monorepo resolution is `loadAndResolveMonorepo` (`src/utils/config.ts`): `loadRawConfig` → `isMonorepoConfig` → `expandWorkspaces(rootDir)` (from `package.json:workspaces` array or `{ packages }` via `Bun.Glob` + exact-path fallback, deduped, `package.json`-verified, sorted) → `resolveMonorepoPackages` (normalizes keys to absolute paths, throws `No preset/rules defined for workspace package "…"` for missing keys / `does not match any workspace package` for extraneous keys / `Invalid ConformConfig` for bad entries, returns ordered `Map`). `expandWorkspaces` throws `No package.json found …` when no manifest and `No workspaces field found …` when workspaces are missing/empty. Merging is `mergePresetWithConfig` (appends `config.plugins`, shallow-merges `rules`, returns original ref if unchanged).

## CLI

```
conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]
```

- `--path <dir>` — Target directory (default `process.cwd()`).
- `--json` — Machine-readable JSON via `renderJson` (mutually exclusive with `--group`; misuse exits 1).
- `-v, --verbose` — Show `pass` results (default hides them; `summary` always counts all).
- `--group <mode>` — TUI grouping: `domains` (default) or `files` (no CLI validation; unknown values fall through to `domains` in `src/cli/reporter/tui.ts`).

Entry is `src/cli/index.ts` (`commander`); `package.json:bin.conform` is `src/cli/index.ts`.

Flow: `src/cli/check.ts` → `check()` dispatch (`loadRawConfig` → if `isMonorepoConfig` → `checkMonorepo` else single-package `loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`) → `process.stdout.write(rendered)` → exit code. `checkMonorepo` iterates per-package `presetResolver`/`mergePresetWithConfig`/`buildPackageConformance`, aggregates summary, renders `MonorepoConformOutput` JSON or concatenated TUI blocks. Monorepo errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`) all exit 2. A missing `package.json` at the root maps to `monorepo-config-error`.

Engine (`src/api/engine.ts`): flattens `preset.plugins[].rules`, parses each override via `parseOverride`/`normalizeLevel` (`error`→`fail`, unknown → fail-closed), rejects unknown severity as `fail` `Invalid severity "…"` without calling `check`, skips `off`, forwards flattened params (rest of override minus `level`) to `rule.check(targetPath, params?)`, coerces non-`pass` results via `coerceStatus`. Param validation lives in `src/api/plugin.ts` (`validateParams` inside the `Plugin.rules` getter wrapper; invalid → `fail` with `Invalid params: …` without calling `test`); when a schema exists but no extra params are given, `undefined` is forwarded without validation; when no schema exists, params forward unvalidated. `level` is optional; a `RuleLevel` string alone is also accepted.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules `pass` |
| 1 | One or more `fail` (takes priority over `warn`), **or** `--json`+`--group` misuse |
| 2 | `warn` only (no `fail`), **or** no `conform.config.ts` (`no-config`), **or** preset not found (`preset-not-found`), **or** monorepo config errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`) |

`hasFail` dominates `hasWarn` in `src/api/engine.ts` and `src/cli/check.ts`. `checkMonorepo` maps thrown messages to codes: `No workspaces field` → `monorepo-no-workspaces`, `No preset/rules defined` → `monorepo-unconfigured-package`, `does not match any workspace` → `monorepo-extraneous-package`, else `monorepo-config-error` (includes `No package.json found …`).

## TUI & JSON

`renderTui(presetName, results, { verbose, groupBy })` (`src/cli/reporter/tui.ts`) — `renderByDomains` (default) uses `Map<domain, Map<filesKey, RuleResult[]>>` preserving insertion order, `renderByFiles` uses `Map<filesKey, RuleResult[]>`. Keys are `files.join(", ")`. Header `@adistack/conform — ${preset} preset`, divider `━×50`, summary `N passed · N warned · N failed` (all counts from full `results`, not `visible`).

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

Monorepo — `checkMonorepo` (`src/api/engine.ts`):
- JSON: `MonorepoConformOutput { path, outputs: ConformOutput[], summary }` (per-package `groupBy` preserved; envelope carries `groupBy: "files"` only when requested).
- TUI: concatenated per-package blocks `━━ <absPath> (<preset>) ━━` + per-package TUI + `Summary: N passed · N warned · N failed across M packages`.

### Params & Overrides detail

- Rule may declare `params?: Type<P>` (arktype) via `Plugin#defineRule`; materialized `Rule` exposes it as `paramsSchema`.
- Override is flat: `{ level?: RuleLevel, ...params }` or `RuleLevel` string alone (`warn`/`off`/`error` only). Only these three strings are accepted — any other string (including `"pass"`) is fail-closed with `Invalid severity "…"`. Engine takes rest of override minus `level` as params via `parseOverride`; validation happens in the `Plugin.rules` wrapper via `validateParams` before `test()`. Invalid → `Status.fail("Invalid params: …")` without calling `test`. When a params schema exists but no extra keys are given, validation is skipped and `undefined` is forwarded; when no schema exists, params forward unvalidated. `level` is optional.
- Severity coercion: `normalizeLevel` maps `error`→`fail`. Unknown severity does not coerce — engine emits `fail` with `Invalid severity "…" for rule "…"` without calling `check`. `off` skips the rule. Any defined override coerces a non-`pass` result to that severity (`coerceStatus`); `pass` results are never rewritten.

## Package Preset — Rule Set

`src/presets/package.ts` — 9 plugins, 62 rules. See `src/plugins/*` for exact messages. Every rule's `files` is `[]` except rules that declare their file (e.g. `husky/hook` declares `.husky/pre-commit` + `.husky/commit-msg`).

| Plugin | Rules | Notes |
|---|---|---|
| `package-json` | 8 | `structure`, `entry-point`, `build-script`, `files-or-npmignore`, `no-install-hooks`, `required-fields`, `typecheck`, `no-prepublish` |
| `biome` | 5 | `dev-deps`, `config-exists`, `config`, `lint-script`, `format-script` |
| `typescript` | 3 | `deps`, `tsconfig`, `compiler-options` (plugin id `typescript`, export `tsconfig_json`) |
| `husky` | 4 | `dev-deps`, `hooks-dir`, `prepare-script`, `hook` |
| `docs` | 5 | `readme`, `changelog`, `contributing`, `license`, `security-md` |
| `gitignore` | 2 | `exists`, `excludes` |
| `github` | 30 | `workflows` (5: `ci-workflow`, `release-workflow`, `ci-lint`, `ci-typecheck`, `dependabot`), `general` (13), `actions` (5), `security` (5), `review` (2: `codeowners`, `pr-checks`) |
| `zed` | 3 | `dir`, `settings-exists`, `settings` |
| `bun` | 2 | `bunfig-exists`, `bunfig-content` |

Shipped preset overrides (`src/presets/package.ts:rules`, all flattened with `level` omitted → no coercion): `biome/config` (`config`), `bun/bunfig-content` (`content`), `gitignore/excludes` (`file_expressions: ["node_modules", ".env*", "*.env", "*.gen.ts"]`), `husky/hook` (`hooks: [{contains:"bun run format",…},{contains:"bun commitlint …",…}]`), `package-json/required-fields` (`fields: [12 entries]`), `typescript/compiler-options` (`compilerOptions`), `zed/settings` (`settings`).
