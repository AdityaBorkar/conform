# Conformance

CLI that checks a repository against a named Preset and reports Drift. Supports single-package (`ConformConfig`) and monorepo (`MonorepoConfig`) modes.

## Language

**Preset**:
 Named collection of Plugins plus optional RuleOverrides (`StrictPresetRules` per-preset, `StrictRuleOverrides` globally). Lives in `src/presets/*.ts`. Composed via `definePreset` — curried `definePreset(plugins)(config)` (preferred, infers per-preset params) or object `definePreset({ name, description, plugins, rules? })`. Validated by `isValidPreset` requiring `name:string` + `description:string` + `plugins:array`.
 _Avoid_: Template, preset (lowercase alias)

**Plugin**:
 Unit that groups related Rules. Declares `id` + `context: (target: Target) => T` and exposes multiple atomic Rules via `Plugin#defineRule`; each Rule declares its own `domain` (no plugin-level default). Rule IDs are namespaced `pluginId/ruleId`.
 _Avoid_: RuleSet

**Rule**:
 Atomic check. Must be defined via `Plugin#defineRule`; standalone `defineRule` does not exist. Declares `id`, `domain`, `files`, `description` (authoring field `name` → materialized `description`), `check` (`test({ context: T, params? })` at authoring), and optional arktype `params` (`paramsSchema` at runtime).
 _Avoid_: aiRule, kind, standalone rule

**CheckResult**:
 Outcome returned by a Rule's `check`: `{ status, message? }` where `status` is `Severity`.
 _Avoid_: AiCheckResult

**Status**:
 Helper that constructs a CheckResult: `Status.pass/warn/fail(message?)`.

**Severity**:
 Result status: `pass | warn | fail`.

**RuleSeverity**:
 Override severity: `Severity | off | error` where `error` maps to `fail` and `off` skips the Rule. Unknown strings fail the rule with `Invalid severity "…"` (fail-closed).

**RuleConfig**:
 One override entry: `RuleLevel` string (`"off"|"warn"|"error"`) or flat object `{ level?: RuleLevel, ...params }` where `...params` (flattened, no `params` wrapper) is validated as Rule `params`; `level` optional.

**RuleOverrides**:
 Map of Rule ID → RuleConfig that coerces non-pass results to the configured severity (pass stays pass, intentionally allowing suppression). Shares the same shape on Preset and on ConformConfig. Unknown severity values are fail-closed.

**RuleRegistry**:
 Auto-inferred global map of known Rule IDs to their validated params types via `InferPresetParamMap<AllBuiltinPlugins>` where `AllBuiltinPlugins` is derived from the `@/plugins/index.ts` barrel (`_PluginModule` → `_BuiltinPluginUnion[]`). Single source of truth — adding `export { foo } from "./foo.ts"` to the barrel extends the registry without touching `src/types.ts`. Unknown keys fall back to `RuleConfig<unknown>`. Drives `StrictRuleOverrides` typing.
 _Avoid_: static hardcoded map of 2-3 IDs

**StrictRuleOverrides**:
 Global typed RuleOverrides via `RuleRegistry`: `{ [K in keyof RuleRegistry]?: RuleConfig<RuleRegistry[K]> } & Record<string, RuleConfig<unknown>>`. Used by `ConformConfig.rules` and `Preset.rules` before per-preset narrowing.

**PresetRuleRegistry**:
 Per-preset registry derived from the preset's own plugins: `InferPresetParamMap<Ps>` for `Ps extends readonly AnyPlugin[]`. Local to the preset tuple, no global hardcoding.

**StrictPresetRules**:
 Per-preset typed overrides via `PresetRuleRegistry<Ps>`: `{ [K in keyof PresetRuleRegistry<Ps>]?: RuleConfig<PresetRuleRegistry<Ps>[K]> } & { [K: string]: RuleConfig<unknown> }` for unknown IDs. Inferred by the curried `definePreset(plugins)(config)` form; object form also infers `Ps` as `const`.

**Target**:
 Filesystem view rooted at a repository path. Wraps `fileExists`, `readFile`, `readJson` (JSONC-tolerant via `stripJsonComments` fallback), `packageJson` and is passed to each Plugin's `context` factory. Also available as `createTarget(path)`.

**Domain**:
 Human display group for a Rule, e.g. `Build & Tasks`, `Style & Validation`, `Dev Environment`. Constants in `src/plugins/utils/domain.ts` (`DOMAIN.*`).
 _Avoid_: Group

**Files**:
 File paths a Rule concerns; second-level TUI grouping key (`files.join(", ")`). Defaults to `[]`.

**RuleResult**:
 Persisted outcome of a Rule: `{ id, domain, files, description, status, message? }`.

**ConformConfig**:
 Single-package repository's `conform.config.ts` shape: `{ preset: string, plugins?: Plugin[], rules?: StrictRuleOverrides }`. Created via `defineConfig`; validated by `isConformConfig` (`preset: string>0`). Missing/falsy `preset` → `no-config` (exit 2).

**MonorepoConfig**:
 Monorepo repository's `conform.config.ts` shape: `Record<string, ConformConfig>` — mapping of package directory (relative or absolute) → `ConformConfig`. Created via `defineMonorepoConfig`; validated by `isMonorepoConfig` (object without top-level `preset`, non-empty). Detected before `ConformConfig` via `loadRawConfig` + `isMonorepoConfig` dispatch in `check()`.

**ConformOutput**:
 Single-package reporter payload: `{ preset, path, results, summary, groupBy? }`. `results` are filtered by `verbose`; `summary` always counts all. `groupBy` only emitted when `"files"`.

**MonorepoConformOutput**:
 Monorepo reporter payload: `{ path, outputs: ConformOutput[], summary }` plus optional `groupBy` envelope mirroring per-package `groupBy`. JSON is the stringified envelope; TUI is concatenated per-package blocks with `━━ <path> (<preset>) ━━` headers plus `Summary: N passed · N warned · N failed across M packages`.

**MonorepoPackageResult**:
 Per-package monorepo result: `{ path, output: ConformOutput, rendered: string, hasFail, hasWarn }`.

**GroupBy**:
 Reporter grouping mode: `domains` (default, domain → files) or `files` (flat by file).

**Drift**:
 Any `warn` or `fail` RuleResult; deviation of a repo from its Preset.

**Engine**:
 Runner that dispatches monorepo vs single-package. Single-package: `loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`. Monorepo: `loadRawConfig → isMonorepoConfig → loadAndResolveMonorepo → expandWorkspaces → resolveMonorepoPackages → (per-package) presetResolver → mergePresetWithConfig → buildPackageConformance → aggregate`. Flattens `preset.plugins[].rules`, applies RuleOverrides via `parseOverride`/`normalizeLevel` (`error`→`fail`, unknown → fail-closed without calling `check`), skips `off`, forwards flattened params (rest minus `level`) to `rule.check(targetPath, params?)` with validation in `Plugin.rules` (`validateParams` → `fail` `Invalid params: …` without calling `test`).

**Resolver**:
 Function `presetResolver(name)` that resolves a preset name to a Preset by importing `src/presets/<name>.ts` or `src/presets/<name>/index.ts` from repo root (`resolve(import.meta.dir,"..","..")` + `join(packageRoot,"src","presets")`), `existsSync`-filtered candidates, `isValidPreset`-gated.
 _Avoid_: resolver

**expandWorkspaces**:
 Utility `expandWorkspaces(rootDir)` that reads `package.json:workspaces` (array or `{ packages }`) and expands globs via `Bun.Glob` plus exact-path fallback, deduplicates, verifies `package.json` per package, and returns sorted absolute paths. Throws `No workspaces field` if missing/empty.

**resolveMonorepoPackages**:
 Utility `resolveMonorepoPackages(rootDir, monorepoConfig, discovered)` that normalizes `MonorepoConfig` keys to absolute paths, throws `No preset/rules defined for workspace package "…"` for missing keys and `does not match any workspace package` for extraneous keys, validates each entry via `isConformConfig`, and returns an ordered `Map<string, ConformConfig>` in discovered order.

**checkMonorepo**:
 Engine entry `checkMonorepo(rootDir, opts)` that orchestrates `loadAndResolveMonorepo` → per-package `presetResolver`/`mergePresetWithConfig`/`buildPackageConformance` → aggregated `MonorepoConformanceResult { outputs, packageResults, summary, hasFail, hasWarn, rendered }`. Errors map to codes `monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error` (all exit 2).
