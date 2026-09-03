# Conformance

CLI that checks a repository against a named Preset and reports Drift. Supports single-package (`ConformConfig`) and monorepo (`MonorepoConfig`) modes.

## Language

**Preset**:
 Named collection of Plugins plus optional RuleOverrides. Lives in `src/presets/*.ts`.
 _Avoid_: Template, preset (lowercase alias)

**Plugin**:
 Unit that groups related Rules. Each Rule declares its own `domain`; Rule IDs are namespaced `pluginId/ruleId`.
 _Avoid_: RuleSet

**Rule**:
 Atomic check defined via `Plugin#defineRule`. Declares `id`, `domain`, `files`, `description`, and optional params.
 _Avoid_: standalone rule, kind

**CheckResult**:
 Outcome returned by a Rule: `{ status, message? }` where `status` is a `Severity`.

**Status**:
 Helper that constructs a CheckResult: `Status.pass/warn/fail(message?)`.

**Severity**:
 Result status: `pass | warn | fail`.

**RuleLevel**:
 Override severity: `warn | off | error`, where `error` maps to `fail` and `off` skips the Rule.
 _Avoid_: RuleSeverity

**RuleConfig**:
 One override entry: a `RuleLevel` string or a flat object `{ level?, ...params }` with `level` optional and no `params` wrapper.

**RuleOverrides**:
 Map of Rule ID to `RuleConfig`. Coerces non-`pass` results to the configured severity; `pass` stays `pass`.

**RuleRegistry**:
 Global map of known Rule IDs to their params types, auto-inferred from the `@/plugins/index.ts` barrel.
 _Avoid_: hardcoded map

**StrictRuleOverrides**:
 Global typed `RuleOverrides` driven by `RuleRegistry`. Used by `ConformConfig.rules`.

**StrictPresetRules**:
 Per-preset typed overrides inferred from the preset's own plugins. Inferred by the curried `definePreset(plugins)(config)` form.

**Target**:
 Filesystem view rooted at a repository path. Exposes `fileExists`, `readFile`, `readJson`, and `packageJson`.

**Domain**:
 Human display group for a Rule, e.g. `Build & Tasks`, `Style & Validation`. Constants in `DOMAIN`.
 _Avoid_: Group

**Files**:
 File paths a Rule concerns. Second-level display grouping key; defaults to `[]`.

**RuleResult**:
 Persisted outcome of a Rule: `{ id, domain, files, description, status, message? }`.

**ConformConfig**:
 Single-package `conform.config.ts` shape: `{ preset, plugins?, rules? }`. Created via `defineConfig`.

**MonorepoConfig**:
 Monorepo `conform.config.ts` shape: mapping of package directory to `ConformConfig`. Created via `defineMonorepoConfig`.

**ConformOutput**:
 Single-package reporter payload: `{ preset, path, results, summary, groupBy? }`.

**MonorepoConformOutput**:
 Monorepo reporter payload: `{ path, outputs, summary }`.

**GroupBy**:
 Reporter grouping mode: `domains` (default) or `files`.

**Drift**:
 Any `warn` or `fail` RuleResult; deviation of a repo from its Preset.

**Engine**:
 Runner that checks a target path and renders results, dispatching single-package vs monorepo.
