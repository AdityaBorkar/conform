# ADR 004: Plugin Architecture with Oxc-Style Overrides

## Status

Accepted — 2026-08-24. Rewritten 2026-08-25 to reflect current `src/*` (9 plugins / 37 rules, auto-inferred `RuleRegistry`, curried `definePreset`).

## Context

After ADR 002 (atomic rules, grouped display) the codebase evolved away from `preset { rules: Rule[] }` and `CheckContext` toward a plugin-composed model. `src/types.ts` now defines `Preset { plugins: Plugin[], rules?: StrictRuleOverrides }`, `Plugin<T>` with `context: (target: Target) => T` and `.defineRule({ id, domain, name, test: ({context, params?}) })` (plus `files?`, `params?`). No standalone `defineRule` exists — all Rules must be defined via a Plugin. Severity overrides are oxc/eslint-style (`RuleOverrides`/`StrictRuleOverrides`/`StrictPresetRules` with `RuleLevel` string or flat `{ level?: RuleLevel, ...params }`, `level` optional). Need to record why.

History: 2026-08-24 removed standalone `defineRule` (rules always plugin-owned) and removed plugin-level `domain` (per-rule `domain` required; no `ruleDef.domain ?? this.config.domain` fallback in `src/api/plugin.ts`). `isValidPreset` (`src/api/preset.ts:33`) now requires `description:string`. Unknown severity strings are fail-closed (`Invalid severity "…"`). Original draft cited 7 plugins / 36 rules and a hardcoded 3-entry `RuleRegistry`; the barrel-driven inference and two new plugins (`zed`, `bun`) supersede that.

## Decision

- **Preset composes Plugins, not Rules directly.** `src/presets/*.ts` assemble `src/plugins/*` plugins. The canonical `package` preset (`src/presets/package.ts`) composes 9 plugins — `packageJson`, `biome`, `tsconfig_json`, `husky`, `docs`, `gitignore`, `github`, `zed`, `bun` — totalling 37 atomic rules.
- **Plugin owns context extraction (no domain on Plugin).** `Plugin<T>` is `new Plugin({ id, context })` (or `definePlugin`) — per-rule `domain` is required; no plugin-level domain or fallback. `files` is optional per-rule (default `[]`). Rules namespace to `pluginId/ruleId`; `paramsSchema` via arktype `params` is optional. Rules inside a plugin receive typed `context` via `test({ context: T, params?: P })`; `Target` (`src/utils/fs.ts`) is the FS view passed to `context`. All Rules are defined via `Plugin#defineRule`; no standalone `defineRule` exists.
- **Overrides are oxc-style and typed — auto-inferred registry.** `RuleRegistry` is not a hardcoded map; it is `InferPresetParamMap<AllBuiltinPlugins>` where `AllBuiltinPlugins` is derived from the `@/plugins/index.ts` barrel (`_PluginModule` → `_BuiltinPluginUnion[]`). Adding `export { foo } from "./foo.ts"` to the barrel extends the registry without touching `src/types.ts`. `StrictRuleOverrides` is the global typed view (`RuleRegistry` + `Record<string, RuleConfig<unknown>>` for unknown IDs). Per-preset, `definePreset` is curried — `definePreset([p1, p2] as const)({ name, description, rules? })` captures `Ps` and infers `StrictPresetRules<Ps>` via `PresetRuleRegistry<Ps> = InferPresetParamMap<Ps>` (object form `definePreset({ name, description, plugins, rules? })` also infers `Ps` as `const`). Unknown rule IDs remain accepted as `RuleConfig<unknown>`. Overrides merge via `mergePresetWithConfig` (`src/api/engine.ts:134`): append `config.plugins`, shallow-merge `rules` (`{ ...preset.rules, ...config.rules }`), return original ref if unchanged.
- **Engine coercion & validation.** `engine.ts` `normalizeLevel` maps `error`→`fail`; `off` skips; unknown severity → `fail` with `Invalid severity "…"` (fail-closed, without calling `check`); non-pass results are coerced to configured severity; `pass` stays `pass` (intentionally allowing suppression). Flat `{ level?: RuleLevel, ...params }` (or `RuleLevel` string) passes flattened params (rest minus `level`) validated against `paramsSchema` before `test` via `validateParams` (`src/api/plugin.ts:12`); `level` optional; invalid → `fail` with `Invalid params: …` without calling `test`.
- **Result & output model — single-package and monorepo.** `RuleResult { id, domain, files, description, status, message? }` and `ConformOutput { preset, path, results, summary, groupBy? }`. For monorepos, `MonorepoConfig = Record<string, ConformConfig>` (`defineMonorepoConfig`), `MonorepoConformOutput { path, outputs: ConformOutput[], summary }`, `MonorepoPackageResult { path, output, rendered, hasFail, hasWarn }`. Reporters filter `pass` unless `verbose`, and group by `GroupBy = "domains"|"files"` via `DOMAIN` constants. Monorepo dispatch is `check()` → `loadRawConfig` → `isMonorepoConfig` → `checkMonorepo` (`expandWorkspaces` + `resolveMonorepoPackages`) vs single-package path.
- **No CheckContext, no Group field, no AI kind.** Former `CheckContext { targetPath, readFile, readJson, fileExists, packageJson }` and `Rule.group` are removed; FS goes through `Target`/`src/utils/fs.ts`. AI fields removed per ADR 003 superseded.

## Rationale

- **Context isolation** — Each plugin declares exactly the FS surface it needs; tests can inject a fake context without touching disk. `Plugin#defineRule` keeps rules trivial and consistently namespaced.
- **Composability & discoverability** — Presets are just lists of plugins; adding a preset is a new file in `src/presets/`, adding a domain is a new file in `src/plugins/` plus a one-line barrel export that automatically extends `RuleRegistry`. Domains use `utils/domain.ts` display strings, enabling consistent TUI grouping.
- **Familiar override UX with full type safety** — Oxc/ESLint-style severity strings reduce learning curve; `"off"`/`"warn"` in `conform.config.ts` lets repos tune without forking a preset. Barrel-inferred `RuleRegistry` + per-preset `StrictPresetRules<Ps>` give typed `params` for every param-typed rule (currently `package-json/*`, `biome/*`, `husky/*`, `docs/*`, `gitignore/excludes`, `github/*`, `zed/*`, `bun/*`) with flattened `{ level?, ...params }`, `level` optional, without hardcoding IDs.

## Consequences

- Authoring docs must teach `Plugin`/`definePlugin` + `Status` + `Target` + curried `definePreset(plugins)(config)`, not `rule()/aiRule()` or `CheckContext`.
- Resolver is `presetResolver` looking at `src/presets/` (was `presets/`), `bin` path is `src/cli/index.ts`, reporters are wired in `src/cli/check.ts` via `check()`→`renderTui`/`renderJson` with monorepo branch. See `docs/architecture.md`.
- `ConformConfig` is single-package (`preset` required); `MonorepoConfig` is `Record<string, ConformConfig>` for workspaces (validated via `isMonorepoConfig` / `resolveMonorepoPackages` / `expandWorkspaces`).
- `Rule` severity is per-rule via `Status` in code; `RuleOverrides`/`StrictRuleOverrides`/`StrictPresetRules` only remap displayed `status` (coercion), not the rule's intrinsic logic. Flat form `{ level?: RuleLevel, ...params }` (or `RuleLevel` string) passes validated flattened params (rest minus `level`) via `validateParams` (arktype) before `test`; `level` optional.

## Alternatives Considered

- **Flat `rules: Rule[]` on preset (ADR 001/002 model)** — Simple but no shared context, no domain grouping primitive, no reuse across presets.
- **CheckContext object passed to every rule** — Every rule gets identical wide API; harder to test/mock per plugin and encourages coupling.
- **Declarative YAML/JSON rule DSL** — Would require DSL maintenance and escape hatches converging to code anyway (ADR 001 rationale).
- **Per-preset severity field on Rule** — Less flexible than a separate override map; overrides compose across preset and user config.
- **Hardcoded RuleRegistry of 2-3 IDs** — Enumerating `husky/hook | package-json/required-fields | gitignore/excludes` in `src/types.ts` required manual updates per new param-typed rule; replaced by barrel inference (`InferPresetParamMap<AllBuiltinPlugins>`).

## Related

- ADR 001 — Code-based presets (still accepted).
- ADR 002 — Atomic rules with grouped display (still accepted; grouping now `domain`+`files`).
- ADR 003 — Deterministic + AI rules (superseded by this ADR).
