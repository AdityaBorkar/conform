# ADR 004: Plugin Architecture with Oxc-Style Overrides

## Status

Accepted — 2026-08-24. Codifies `src/types.ts` + `src/api/*` as built. Amended 2026-08-24: remove stale `definePresetLegacy`/`isLegacyPreset` references; code has no legacy shim.

## Context

After ADR 002 (atomic rules, grouped display) the codebase evolved away from `preset { rules: Rule[] }` and `CheckContext` toward a plugin-composed model. `src/types.ts` now defines `Preset { plugins: Plugin[], rules?: StrictRuleOverrides }`, `Plugin<T>` with `context: (target: Target) => T` and `.defineRule({ id, domain, name, test: ({context, params?}) })` (plus `files?`, `params?`), and standalone `defineRule({ id, domain, files, description, check, params? })`. Severity overrides are oxc/eslint-style (`RuleOverrides`/`StrictRuleOverrides` with `"off"|"warn"|"error"|"fail"|"pass"` plus tuple `[RuleSeverity, P, ...]`) . Need to record why.

## Decision

- **Preset composes Plugins, not Rules directly.** `src/presets/*.ts` assemble `src/plugins/*` plugins (today `package.ts` with 7 plugins + `monorepo.ts` stub).
- **Plugin owns context extraction.** `Plugin<T>` is `new Plugin({ id, domain, context })` (or `definePlugin`) — `domain` is required; per-rule `domain` and `files` are explicit (rules namespace to `pluginId:ruleId`; `paramsSchema` via arktype `params` is optional). Rules inside a plugin receive typed `context` via `test({ context: T, params?: P })`; `Target` (`src/utils/fs.ts`) is the FS view passed to `context`.
- **Standalone Rule exists for one-offs** — `defineRule({ id, domain, files, description, check, params? })` taking `(targetPath: string, params?) => CheckResult` directly, with `validateParams` applied before `check`.
- **Overrides are oxc-style and typed.** `Preset.rules` and `ConformConfig.rules` are `StrictRuleOverrides` (extends `RuleOverrides` with `RuleRegistry` typing for `husky:hook` and `package-json:required-fields`). They merge via `mergePresetWithConfig` (config overrides preset). `engine.ts` `normalizeSeverity` maps `"error"→"fail"`; `"off"` skips; non-pass results are coerced to configured severity; `pass` stays pass. Tuple `[severity, params]` passes `params` as `opts[0]` validated against `paramsSchema` before `test`; invalid → `fail` with `Invalid params: …`.
- **Result & output model.** `RuleResult { id, domain, files, description, status, message? }` and `ConformOutput { preset, path, results, summary, groupBy? }`. Reporters filter `pass` unless `verbose`, and group by `GroupBy = "domains"|"files"` via `DOMAIN` constants.
- **No CheckContext, no Group field, no AI kind.** Former `CheckContext { targetPath, readFile, readJson, fileExists, packageJson }` and `Rule.group` are removed; FS goes through `Target`/`src/utils/fs.ts`. AI fields removed per ADR 003 superseded.

## Rationale

- **Context isolation** — Each plugin declares exactly the FS surface it needs; tests can inject a fake context without touching disk. `defineRule` keeps simple rules trivial.
- **Composability & discoverability** — Presets are just lists of plugins; adding a preset is a new file in `src/presets/`, adding a domain is a new file in `src/plugins/`. Domains use `utils/domain.ts` display strings, enabling consistent TUI grouping.
- **Familiar override UX** — Oxc/ESLint-style severity strings reduce learning curve; `"off"`/`"warn"` in `conform.config.ts` lets repos tune without forking a preset; `StrictRuleOverrides` gives typed `params` for the two param-typed rules (`husky:hook`, `package-json:required-fields`).

## Consequences

- Authoring docs must teach `Plugin`/`definePlugin` + `Status` + `Target`, not `rule()/aiRule()` or `CheckContext`.
- Fixed 2026-08-24: resolver is `presetResolver` looking at `src/presets/` (was `presets/`), `bin` path is `src/cli.ts` re-export, reporters are wired in `src/cli/check.ts` via `check()`→`renderTui`/`renderJson`. See `docs/architecture.md`.
- `ConformConfig` gains `plugins?`/`rules?` beyond `preset` (already in `src/types.ts` as `StrictRuleOverrides`).
- `Rule` severity is per-rule via `Status` in code; `RuleOverrides`/`StrictRuleOverrides` only remap displayed `status` (coercion), not the rule's intrinsic logic. Tuple form `[severity, params]` passes validated `params` via `validateParams` (arktype) before `test`.

## Alternatives Considered

- **Flat `rules: Rule[]` on preset (ADR 001/002 model)** — Simple but no shared context, no domain grouping primitive, no reuse across presets.
- **CheckContext object passed to every rule** — Every rule gets identical wide API; harder to test/mock per plugin and encourages coupling.
- **Declarative YAML/JSON rule DSL** — Would require DSL maintenance and escape hatches converging to code anyway (ADR 001 rationale).
- **Per-preset severity field on Rule** — Less flexible than a separate override map; overrides compose across preset and user config.

## Related

- ADR 001 — Code-based presets (still accepted).
- ADR 002 — Atomic rules with grouped display (still accepted; grouping now `domain`+`files`).
- ADR 003 — Deterministic + AI rules (superseded by this ADR).
