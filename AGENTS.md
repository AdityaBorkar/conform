# AGENTS.md

## Docs Map

1. `/CONTEXT.md` — ubiquitous language (canonical terms). Read first.
2. `docs/architecture.md` — types, plugin authoring, engine (single + monorepo), CLI, TUI/JSON.
3. `README.md` — install/usage (`preset: "package"`, `defineMonorepoConfig`).

## Project

`@adistack/conform` — CLI checking repos against code Presets. Bun + TypeScript ESM, no build: `noEmit: true`, `exports "." → ./src/index.ts` (+ `"./plugins" → ./src/plugins/index.ts`), `bin conform → src/cli/index.ts`. Dogfood `conform.config.ts` uses `preset: "package"`.

## Commands

- Install: `bun install` (`bunfig.toml` `ignore-scripts=true`, `minimumReleaseAge=259200`)
- Verify order: `bun run check:types` → `bun run check:lint:ci` (`biome check .`, no fix) → `bun run check:conform`
- Lint fix: `bun run check:lint` (`biome check . --fix`) · Format: `bun run format` · Full lint alias: `bun run lint`
- CLI: `bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]`
- Tests: `bun run test` · `test:unit` (excludes `tests/e2e/**`) · `test:e2e` (`tests/e2e/`) · `test:integration` (`--passWithNoTests`, dir empty)
- Single test: `bunx vitest run tests/e2e/check.test.ts -t "<name>"`
- Deps: `bun run update:deps` (`taze -w && bun install`) · Changeset/version/publish: `changeset` / `version` / `release`

CI (`check.yml`, required on `stable`/`beta`): `check:types` + `check:lint:ci` + `check:conform`. `release.yml` reuses it via `workflow_call`, then `changesets/action` (`publish: bun run release`, `version: bun run version`), branches `stable`/`beta`/`main`. `changelog.yml` also gates on `check.yml` before generating changesets.

## Architecture

- `src/cli/check.ts` — rejects `--json`+`--group` (exit 1); `no-config`/`preset-not-found`/monorepo errors → stderr + exit 2; else `stdout.write(rendered)` → 0 pass / 1 fail / 2 warn-only.
- `src/api/engine.ts` — `check()` dispatches via `loadRawConfig` + `isMonorepoConfig`: single `loadConfig → presetResolver → mergePresetWithConfig → runChecks`; monorepo `loadAndResolveMonorepo → expandWorkspaces → resolveMonorepoPackages → per-package buildPackageConformance → aggregate`. `verbose` filters `results` only; `summary` always counts all; `hasFail` dominates `hasWarn`. Unknown `--group` falls through to `domains` (`tui.ts`).
- `src/utils/config.ts` + `src/utils/workspaces.ts` — dynamic-imports `conform.config.ts`; falsy `preset` → `no-config`. Monorepo keys are relative/absolute pkg dirs; missing key → `monorepo-unconfigured-package`, extraneous key → `monorepo-extraneous-package`, no `package.json:workspaces` → `monorepo-no-workspaces`, missing `package.json` → `monorepo-config-error`.
- `src/api/preset.ts` — resolves `src/presets/<name>.ts` or `<name>/index.ts` from package root; `isValidPreset` requires `name` + `description` + `plugins` array.
- Overrides (`engine.ts:parseOverride/normalizeLevel`, validated `plugin.ts:validateParams`): `RuleLevel "warn"|"off"|"error"` string or flat `{ level?, ...params }` (`level` optional, no `params` wrapper). `error→fail`, `off` skips, `pass` never rewritten, unknown severity (including `"pass"`) → `fail` `Invalid severity "…"` without calling `check`; invalid params → `fail` `Invalid params: …` without calling `test`.
- Entry points: `src/index.ts` (`defineConfig`, `defineMonorepoConfig`, `definePlugin`, `definePreset`, `Status`, `DOMAIN`, `Target`, `check`/`checkMonorepo`) — avoid deep imports. `RuleRegistry` auto-inferred from `src/plugins/index.ts` barrel; adding a plugin export extends it.
- Layout: `src/presets/package.ts` (only preset: 9 plugins, 62 rules) · `src/plugins/` (`package_json` 8, `biome` 5, `tsconfig_json` 3, `husky` 4, `docs` 5, `gitignore` 2, `github` 30 via `github/` submodules, `zed` 3, `bun` 2 + `utils/`). `vitest.config.ts` includes only `tests/**/*.test.ts`.

## Rules & Presets

- `definePlugin({id, context: (target: Target) => T})` + `plugin.defineRule({id, domain, name, files?, params?, test: ({context, params?}) => CheckResult})` — `domain` required per rule; IDs `pluginId/ruleId`; no standalone `defineRule`. Authoring `name`/`test` materialize as runtime `description`/`check(targetPath, params?)`. FS via `Target` (`fileExists`, `readFile`, `readJson` JSONC-tolerant, `packageJson`).
- `definePreset([plugins] as const)({name, description, rules?})` curried preferred (infers `StrictPresetRules`); object form also accepted. `rules` merge: config spreads over preset (`mergePresetWithConfig`).
- `Status.pass/warn/fail(message?)`. `RuleLevel` `error` coerces non-pass to `fail`.
- Canonical: `Preset` not `preset`, `Plugin` not `RuleSet`, `presetResolver` not `resolver`, `domain`+`files` not `group`, `package` not `npm-pkg`, `RuleLevel` not `RuleSeverity`. Full term table in `/CONTEXT.md`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | all `pass` |
| 1 | any `fail` (dominates `warn`), or `--json`+`--group` misuse |
| 2 | `warn`-only, `no-config`, `preset-not-found`, or monorepo errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`) |

## Toolchain & Gotchas

- Bun only; `import.meta.dir`/`import.meta.dirname` for paths; `@/*` → `./src/*` (`tsconfig.json`, `vitest.config.ts`). Cross-module imports must use `@/`.
- TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `allowImportingTsExtensions`); arktype `type()` for rule params.
- Biome 2.x (`assist.actions.source.organizeImports` + formatter + linter): 2-space, double-quotes, LF, width 80; `useNamingConvention`/`noDefaultExport`/`noSecrets` off. No ESLint/Prettier.
- Husky `pre-commit`: `bun run format` only; `commit-msg`: `bun commitlint --edit "$1"`. Commits: conventional `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip`.
