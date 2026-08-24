# Glossary

Source of truth for types: `src/types.ts`; for constants: `src/inbuilt-plugins/utils/domain.ts`.

| Term | Definition |
|------|-----------|
| **Template** | Named collection of `Plugin`s plus optional `RuleOverrides`. `src/presets/*.ts` default-export `defineTemplate({ name, description, plugins, rules? })`. |
| **Plugin** (alias **RuleSet**) | `class Plugin<T>` (`definePlugin` preferred). Declares `id`, optional `domain`, and `context: (targetPath: string) => T`. Owns multiple atomic rules via `.defineRule()`. IDs are namespaced `pluginId:ruleId`. Backward-compat alias `RuleSet`. |
| **Rule** | Atomic check. `{ id, domain, files, description, check: (targetPath: string) => CheckResult }`. Standalone via `defineRule`, or via `Plugin.defineRule({ id, name, domain?, files?, test: ({context:T}) => CheckResult })` where `name` becomes `description`. |
| **CheckResult** | `{ status: Severity, message?: string }` returned by a rule. Built via `Status.pass/warn/fail(message?)`. |
| **Status** | Helper object `Status.pass/warn/fail` constructing `CheckResult`s. |
| **Severity** | `pass \| warn \| fail` — actual result status. |
| **RuleSeverity** | `Severity \| "off" \| "error"` — override severity. `"error"` maps to `"fail"`, `"off"` skips the rule. |
| **RuleConfig** | `RuleSeverity \| [RuleSeverity, ...unknown[]]` — tuple form for future options (first element is severity). |
| **RuleOverrides** | `Record<string, RuleConfig>` — oxc-style map (`"biome:dev-deps": "warn"`). Engine coerces non-pass to configured severity; `off` skips. |
| **Domain** | Human display group, e.g. `DOMAIN.BUILD="Build & Tasks"`, `STYLE="Style & Validation"`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `TESTING`. `Rule.domain`. |
| **Files** | `string[]` on `Rule`/`RuleResult` — file paths the rule concerns; TUI's second-level grouping key. |
| **RuleResult** | Persisted outcome `{ id, domain, files, description, status, message? }`. Produced by `runChecks`. |
| **ConformConfig** | Repo's `conform.config.ts` shape `{ template: string, plugins?: Plugin[], rules?: RuleOverrides }` via `defineConfig`. Loaded by `src/utils/config.ts`. |
| **ConformOutput** | JSON output `{ template, path, results: RuleResult[], summary: {pass,warn,fail}, groupBy? }`. `results` filtered by `verbose`; `groupBy` only `"files"` when grouped by files. Same for TUI `renderTui`. |
| **GroupBy** | `"domains" \| "files"` — TUI/JSON grouping mode (`--group`). Default `domains` (domain→files); `files` flattens to file groups. |
| **Drift** | Any `warn`/`fail` `RuleResult`; deviation from template. |
| **PackageJson** | Subset-typed `package.json` used by plugins (`name`, `version`, `description`, `license`, `type`, `main/module/exports`, `bin`, `files`, `engines`, `dependencies/devDependencies/peerDependencies`, `scripts`, …). Accessed via `packageJson(targetPath)` with `readJson` comment stripping. |
| **Resolver** | `src/api/resolver.ts` — resolves `templateName` → `Template` by importing `templates/<name>.ts` or `templates/<name>/index.ts`. Currently broken (see Gotchas: should be `src/presets/`). |
| **Engine** | `src/api/engine.ts` — `runChecks(template, targetPath)` flattening plugins, applying `RuleOverrides`, awaiting each `check`. |
| **conform.config.ts** | Config file in target repo that declares `template` and optional `plugins`/`rules` overrides. |
| **Preset** | File in `src/presets/` (e.g. `package.ts`) composing `src/inbuilt-plugins/*` plugins into a reusable `Template`. Only `package` is complete; others are stubs. |

Deprecated / removed: `CheckContext` (`targetPath`+`readFile`/`readJson`/`packageJson`/`fileExists`), `Group` (now `domain`+`files`), `kind`/`aiRule`/`AiCheckResult`/`confidence`/`reasoning`/`--disable-ai`/`✱` (AI proposal superseded, ADR 003).
