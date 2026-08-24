# Conformance

CLI that checks a repository against a named Preset and reports Drift.

## Language

**Preset**:
 A named collection of Plugins plus optional RuleOverrides. Lives in `src/presets/*.ts`.
 _Avoid_: Template, preset (lowercase alias)

**Plugin**:
 Unit that owns one domain of checks. Declares a context function and exposes multiple atomic Rules via `defineRule`. Rule IDs are namespaced `pluginId:ruleId`.
 _Avoid_: RuleSet

**Rule**:
 Atomic check. Declares `id`, `domain`, `files`, `description`, `check`, and optional arktype `params`.
 _Avoid_: aiRule, kind

**CheckResult**:
 Outcome returned by a Rule's `check`: `{ status, message? }` where `status` is `Severity`.
 _Avoid_: AiCheckResult

**Status**:
 Helper that constructs a CheckResult: `Status.pass/warn/fail(message?)`.

**Severity**:
 Result status: `pass | warn | fail`.

**RuleSeverity**:
 Override severity: `Severity | off | error` where `error` maps to `fail` and `off` skips the Rule.

**RuleConfig**:
 One override entry: `RuleSeverity` or `[RuleSeverity, ...opts]` where `opts[0]` is validated as Rule `params`.

**RuleOverrides**:
 Map of Rule ID → RuleConfig that coerces non-pass results to the configured severity (pass stays pass). Shares the same shape on Preset and on ConformConfig.

**StrictRuleOverrides**:
 Typed RuleOverrides where known IDs (`husky:hook`, `package-json:required-fields`) enforce their param type via RuleRegistry; other IDs accept any RuleConfig.

**RuleRegistry**:
 Static map of rule IDs to their param types: `husky:hook → HuskyHookSpec[]`, `package-json:required-fields → RequiredFieldsParams`. Drives `StrictRuleOverrides` typing.

**Target**:
 Filesystem view rooted at a repository path. Wraps `fileExists`, `readFile`, `readJson`, `packageJson` and is passed to each Plugin's `context` factory.

**Domain**:
 Human display group for a Rule, e.g. `Build & Tasks`, `Style & Validation`, `Dev Environment`.
 _Avoid_: Group

**Files**:
 File paths a Rule concerns; second-level TUI grouping key.

**RuleResult**:
 Persisted outcome of a Rule: `{ id, domain, files, description, status, message? }`.

**ConformConfig**:
 Repository's `conform.config.ts` shape: `{ preset, plugins?, rules? }`.

**ConformOutput**:
 Reporter payload: `{ preset, path, results, summary, groupBy? }`. `results` are filtered by `verbose`; `summary` always counts all.

**GroupBy**:
 Reporter grouping mode: `domains` (default, domain → files) or `files` (flat by file).

**Drift**:
 Any `warn` or `fail` RuleResult; deviation of a repo from its Preset.

**Engine**:
 Runner that flattens `preset.plugins[].rules`, applies RuleOverrides, and awaits each `check(targetPath, params?)`.

**Resolver**:
 Function `presetResolver(name)` that resolves a preset name to a Preset by importing `src/presets/<name>.ts` or `src/presets/<name>/index.ts`.
 _Avoid_: resolver
