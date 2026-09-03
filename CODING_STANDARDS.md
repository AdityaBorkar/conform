# Coding Standards — @adistack/conform

Source of truth: `src/types.ts`, `src/api/*`, `src/utils/*`, `src/cli/*`, `src/presets/*`, `src/plugins/*`. Terminology in `/CONTEXT.md`.

## 1. Toolchain — Bun Only

- **Runtime & package manager**: Bun only. No npm/pnpm/yarn. Bin is `src/cli/index.ts` (`package.json:bin.conform`). Use `import.meta.dir` (CLI, preset resolver) / `import.meta.dirname` (vitest config) for paths. No `__dirname`/`__filename`.
- **Install**: `bun install` (`bunfig.toml:ignore-scripts=true`, `minimumReleaseAge=259200`, `telemetry=false`, `logLevel=warn`). Scripts `update:deps` (`taze -w && bun install`).
- **No build step**: `tsconfig.json` `noEmit:true`, `exports:"."` → `./src/index.ts` (+ `"./plugins"` → `./src/plugins/index.ts`), `files:["src","README.md"]`, `module:src/index.ts`, `sideEffects:false`. Run directly via `bun run src/cli/index.ts` / `bunx conform`.

## 2. TypeScript 7 — Strict

- Version `^7.0.2` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noEmit`, plus `allowImportingTsExtensions`, `module:Preserve`, `moduleResolution:bundler`, `target:ESNext`, `lib:ESNext`, `types:["@types/bun"]`. Fix unused locals/params rather than suppressing.
- **Types live in `src/types.ts`** — single source for `Severity`, `GroupBy`, `Rule`, `Plugin`, `RuleLevel`, `RuleConfig`, `RuleOverrides`, `RuleRegistry`, `StrictRuleOverrides`, `StrictPresetRules`, `Preset`, `ConformConfig`, `MonorepoConfig`, `ConformOutput`, etc. Do not duplicate shapes elsewhere. `AutoRuleRegistry` is legacy compat only.

## 3. Aliases & Imports

- **Alias** `@/*` → `./src/*` (`tsconfig.json`, `vitest.config.ts`). Always use `@/…` for cross-module imports; never deep-import from another plugin/preset file. Public surface is `src/index.ts` / `src/api/index.ts` (`defineConfig`, `defineMonorepoConfig`, `definePlugin`, `definePreset`, `presetResolver`, `Status`, `DOMAIN`, `Target`) plus `./plugins` barrel.
- **Biome organizeImports** groups: `:URL:` → `:BLANK_LINE:` → `:NODE:` → `:BUN:` → `:PACKAGE_WITH_PROTOCOL:` → `:BLANK_LINE:` → `:PACKAGE:` → `:BLANK_LINE:` → `:ALIAS:` → `:PATH:` (`biome.json` assist actions).

## 4. Formatting & Lint — Biome 2.x

- **Biome `2.x`**: formatter 2-space, double-quotes, LF, `lineWidth:80`, plus `assist.actions.source.organizeImports:all`. Linter `preset:recommended` + `a11y:all`, `complexity:all`, `correctness:all`, `performance:all`, `security:all`, `suspicious:all` (selective `off` per overrides). `vcs: git`.
- Overrides: `noDefaultExport:off`, `useNamingConvention:off`, `noSecrets:off` (+ `noContinue`/`noNestedTernary`/`noTernary`, `noNodejsModules`, `noBarrelFile`, etc. — see `biome.json`). Test files (`**/*.test.ts`) disable `noExcessiveLinesPerFunction`/`noMagicNumbers`; `src/plugins/*.ts` + `src/plugins/**/*.ts` disable `noExcessiveLinesPerFunction`/`noExcessiveLinesPerFile`/`useExportsLast`; `scripts/**/*.ts` relaxes `noConsole` etc.
- Commands: `bun run check:lint` (`biome check . --fix`), `bun run check:lint:ci` (`biome check .`, no fix), `bun run format` (`biome format --write .`), `bun run lint` (alias for `biome check .`), `bun run check:types` (`tsc --noEmit`). Required order: `check:types` → `check:lint:ci` → `check:conform`. CI (`check.yml`) runs all three.

## 5. Testing — Vitest

- `vitest.config.ts` `include:["tests/**/*.test.ts"]` only — `src/**/*.test.ts` ignored. `tests/e2e/check.test.ts` (2 tests: exit in `[0,1,2]` on `.`, exit `2` on `/tmp`); `tests/integration/` is empty (`--passWithNoTests`). Commands: `bun run test` / `test:unit` (`--exclude 'tests/e2e/**'`) / `test:e2e` (`tests/e2e/`) / `test:integration` / `test:watch`. Single test: `bunx vitest run tests/e2e/check.test.ts -t "<name>"`.

## 6. Git Hooks & Release

- Husky `pre-commit: "bun run format"`, `commit-msg: "bun commitlint --edit \"$1\""` (`type-enum: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip`).
- Changesets: `baseBranch:main`, `access:public`, `commit:false`. `bun run changeset` / `version` / `release` (`changeset publish`, `NPM_TOKEN`, `provenance:true`).

## 7. Domain Model Conventions

- Use canonical terms from `/CONTEXT.md`: `Preset`, `Plugin`, `Rule`, `CheckResult`, `Status`, `Severity`, `RuleLevel`, `RuleConfig`, `RuleOverrides`, `StrictRuleOverrides`, `RuleRegistry`, `StrictPresetRules`, `Target`, `Domain`, `Files`, `RuleResult`, `ConformConfig`/`MonorepoConfig`, `ConformOutput`/`MonorepoConformOutput`, `GroupBy`, `Drift`, `Engine`.
- `Domain` strings live in `src/plugins/utils/domain.ts` (`DOMAIN.*`: `BUILD`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `STYLE`, `TESTING`). `GroupBy` is `domains|files` (`domains` default). `Target` (`src/utils/fs.ts`) is the sole FS view (`fileExists`, `readFile`, `readJson` with JSONC fallback, `packageJson`).

## 8. Plugin & Rule Authoring

- **Plugins own Rules**: `definePlugin({ id, context: (target: Target) => T })` + `plugin.defineRule({ id, domain, name, files?, params?, test: ({ context: T, params? }) => CheckResult })`. Every `Rule` declares its own `domain` (no plugin-level default). IDs materialize as `pluginId/ruleId`. No standalone `defineRule`. Authoring `name`/`test` materialize as runtime `description`/`check(targetPath, params?)`.
- **Status helper**: return `Status.pass/warn/fail(message?)` → `{ status, message? }` (`src/api/status.ts`).
- **Params**: arktype `params: Type<P>` on `defineRule`; materialized as `paramsSchema`. Overrides are flat `{ level?: RuleLevel, ...params }` or `RuleLevel` string; validated in `src/api/plugin.ts:validateParams` before `test` (invalid → `fail` `Invalid params: …` without calling `test`). Engine forwards rest-minus-`level` as params.
- **Severity overrides**: `RuleLevel = "warn"|"off"|"error"` (`error`→`fail`). `off` skips, `warn`/`error` coerce non-`pass` only (`pass` stays `pass`), unknown severity (including `"pass"`) → `fail` `Invalid severity "…"` fail-closed without calling `check`.
- **Context isolation**: each plugin declares exactly the `Target` surface it needs; `github` context additionally resolves owner/repo from `package.json:repository` or `.git/config`. Tests inject fake context without touching disk.

## 9. Preset Authoring

- Presets live in `src/presets/*.ts` (`package.ts` is canonical: 9 plugins, 62 rules). Compose `src/plugins/*` via `definePreset`.
- **Curried form for typed overrides**: `definePreset([pluginA, pluginB] as const)({ name, description, rules? })` infers `StrictPresetRules<Ps>` from the plugin tuple (`PresetRuleRegistry<Ps>`). Object form `definePreset({ name, description, plugins, rules? })` is also accepted.
- `rules` is `StrictPresetRules<Ps>` (per-preset, auto-inferred) extending `StrictRuleOverrides` (global `RuleRegistry = InferPresetParamMap<AllBuiltinPlugins>` from `@/plugins/index.ts` barrel — no hardcoded list). Unknown IDs still accepted as `RuleConfig<unknown>`.
- `isValidPreset` (`src/api/preset.ts`) requires `name:string` + `description:string` + `plugins:array` + optional `rules:object` (non-array).
- `mergePresetWithConfig` (`src/api/engine.ts`) appends `config.plugins` to `preset.plugins` and shallow-merges `rules` (`{ ...preset.rules, ...config.rules }`); returns original ref if unchanged.

## 10. Config & Engine

- **Single-package**: `conform.config.ts` → `defineConfig({ preset, plugins?, rules? })` (`rules?: StrictRuleOverrides`). `loadConfig` requires truthy `preset`; falsy → `no-config` (exit 2).
- **Monorepo**: `conform.config.ts` → `defineMonorepoConfig({ "<pkgDir>": ConformConfig, … })` (`MonorepoConfig`). Detected via `isMonorepoConfig` (no top-level `preset`, non-empty). Resolved via `loadAndResolveMonorepo` → `expandWorkspaces` (`src/utils/workspaces.ts`, from `package.json:workspaces` via `Bun.Glob`) → `resolveMonorepoPackages` (normalized absolute keys, validates all discovered packages have a key and no extraneous keys; throws `No package.json found …` / `No workspaces field …` / `No preset/rules defined …` / `does not match any workspace …` / `Invalid ConformConfig …`).
- **Engine dispatch** (`src/api/engine.ts:check`): first `loadRawConfig` → if `isMonorepoConfig` → `checkMonorepo`; else `loadConfig` → `presetResolver` → `mergePresetWithConfig` → `buildPackageConformance` (`runChecks` → `visible` filtered by `verbose`, `summary` always counts all, `groupBy` only emits `"files"`). `checkMonorepo` iterates per-package, aggregates summary, renders per-package TUI blocks or monorepo JSON envelope (`MonorepoConformOutput`). Unmapped throws (e.g. `No package.json found …`) map to `monorepo-config-error`.
- **Resolver**: `presetResolver(name)` imports `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from package root, `existsSync`-filtered candidates, `isValidPreset`-gated.

## 11. CLI & Output

- `src/cli/index.ts` (`commander`): `conform check [--path <dir>] [--json] [-v|--verbose] [--group domains|files]` (`path` defaults to `process.cwd()`). `--json`+`--group` → stderr + exit 1. `src/cli/check.ts` writes `rendered` to stdout, exits `0` pass / `1` fail (dominates warn) / `2` warn-only or `no-config`/`preset-not-found`/`monorepo-*` errors.
- **TUI** (`src/cli/reporter/tui.ts`): `renderByDomains` (default `Map<domain, Map<filesKey, RuleResult[]>>`) vs `renderByFiles` (`Map<filesKey, RuleResult[]>`); keys are `files.join(", ")`; header `@adistack/conform — ${preset} preset`, divider `━×50`, summary `N passed · N warned · N failed`. `renderJson` emits `ConformOutput` (`visible` obeys `verbose`, `summary` counts all, `groupBy` only when `"files"`). Monorepo JSON is `MonorepoConformOutput { path, outputs: ConformOutput[], summary }` (+ `groupBy:"files"` envelope only when requested); TUI is concatenated `━━ <path> (<preset>) ━━` blocks + `Summary: … across M packages`.

## 12. Accessibility & Governance

- Public exports only via `src/index.ts` + `src/api/index.ts` + `src/plugins/index.ts` barrel (auto-inferred `RuleRegistry`) plus `./plugins` subpath export. No deep imports like `src/plugins/biome.ts` from outside `src/`.
