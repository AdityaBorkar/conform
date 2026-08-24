# AGENTS.md

## Docs Map

1. `/CONTEXT.md` — ubiquitous language (canonical terms). Read first.
2. `docs/architecture.md` — types, plugin authoring, preset layout, engine, CLI, TUI/JSON.
3. `README.md` — install/usage (`preset: "package"`).
4. `docs/adr/` — 001 code presets, 002 atomic rules, 004 plugin overrides (003 superseded).

Deprecated: `docs/CONTEXT.md` / `docs/glossary.md` → `/CONTEXT.md`.

## Project

`@adistack/conform` — CLI that checks repos against conformance Presets. Bun + TypeScript ESM (`"type": "module"`). No build: `noEmit: true`, `exports: "." → ./src/index.ts`, `files: ["src","README.md"]`, bin `conform → src/cli/index.ts`.

## Commands

- Install: `bun install` (`bunfig.toml:12` `ignore-scripts=true`, `minimumReleaseAge=259200`)
- Lint: `bun run check:lint` (`biome check . --fix`) · Format: `bun run format` (`biome format --write .`)
- Typecheck: `bun run check:types` (`tsc --noEmit`)
- CLI: `bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]`
- Tests: `bun run test` (`vitest run`) · `bun run test:unit` (`--exclude 'tests/e2e/**'`) · `bun run test:e2e` · `bun run test:integration` (`--passWithNoTests`, dir empty) · `bun run test:watch`
- Single test: `bunx vitest run tests/e2e/check.test.ts -t "<name>"`
- Changeset: `bun run changeset` · Version: `bun run version` · Publish: `bun run release`

Required order: `check:lint` → `check:types` → `test`. CI (`release.yml:22`) runs only `check:lint` + `check:types` before `changesets/action`.

## Architecture

- `src/cli/index.ts` — `commander` entrypoint (reads `../../package.json` via `import.meta.dir`); `src/cli/check.ts` — rejects `--json`+`--group` (exit 1), calls `check()` → `stdout.write(rendered)` → exit 0 pass / 1 fail / 2 warn|no-config|preset-not-found.
- `src/api/engine.ts` — `check()` = `loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`. `output.results` filtered by `verbose`; `summary` always counts all; `hasFail` dominates `hasWarn`.
- `src/utils/config.ts` — dynamic-imports `conform.config.ts` from target dir; requires `config.preset: string` else `no-config` (exit 2).
- `src/api/preset.ts:6` — resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` at repo root (`resolve(import.meta.dir,"..","..")`+`join`); `isValidPreset` requires `name:string` + `description:string` + `plugins:array`. Dogfood `conform.config.ts:4` uses `preset: "package"`.
- `src/api/plugin.ts:12` — `validateParams` via arktype; invalid params → `fail` with `Invalid params: …` without calling `test`. `src/api/engine.ts:80` flattens `preset.plugins[].rules`, applies `preset.rules` overrides (`off` skips, `pass`/`warn`/`error→fail` coerce non-pass with `pass` results never rewritten; unknown severity → `fail` `Invalid severity "…"`, `["warn", params]` passes `params` as `opts[0]`).
- `src/types.ts` — `Rule {id,domain,files,description,check,paramsSchema?}`, `Plugin {id,rules}`, `Preset {name,description,plugins,rules?: StrictRuleOverrides}`, `ConformConfig {preset,plugins?,rules?}`. `RuleRegistry` maps `husky:hook` and `package-json:required-fields` to typed params.
- `src/api/index.ts` + `src/index.ts` — re-exports `defineConfig`, `definePlugin`/`Plugin`, `definePreset`/`presetResolver`, `Status`, plus `DOMAIN` and `Target` (avoid deep imports).
- Presets: `src/presets/package.ts` (complete, 7 plugins). Plugins: `src/plugins/*.ts` — `package_json`, `biome`, `tsconfig`, `husky`, `docs`, `gitignore`, `github`.

For authoring examples see `docs/architecture.md`.

## Rules & Presets

- `definePlugin({id,context: (target: Target) => T})` + `.defineRule({id,name,domain,files?,params?,test: ({context:T,params?}) => CheckResult})` (`src/api/plugin.ts`) — `domain` required per rule (no plugin-level default). IDs `pluginId:ruleId`. All Rules must be defined via a Plugin; standalone `defineRule` does not exist.
- `Status.pass/warn/fail(message?)` → `{status,message?}`.
- `definePreset({name,description,plugins,rules?})` — `rules: Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>` (`RuleSeverity="pass"|"warn"|"fail"|"off"|"error"`, `error`→`fail`).
- Domains: `src/plugins/utils/domain.ts` — `STYLE`, `BUILD`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `TESTING`.

Canonical: `Preset` not `preset`, `Plugin` not `RuleSet`, `presetResolver` not `resolver`, `domain`+`files` not `group`, `package` not `npm-pkg`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | all `pass` |
| 1 | any `fail` (dominates `warn`), or `--json`+`--group` misuse |
| 2 | `warn` only (no `fail`), or `no-config`, or `preset-not-found` |

## Toolchain & Gotchas

- Bun only; `import.meta.dir` for paths. Alias `@/*` → `./src/*` (`tsconfig.json:31`, `vitest.config.ts:8`).
- TypeScript `^7.0.2` strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `noEmit`). `arktype` for rule params.
- Biome 2.x (`biome.json:3` `preset: all`): 2-space, double-quotes, LF, width 80, `organizeImports` groups, `vcs: git`. Overrides: `noDefaultExport: off`, `useNamingConvention: off`, `noSecrets: off`. No ESLint/Prettier.
- `vitest.config.ts:12` `include: ["tests/**/*.test.ts"]` only — `src/**/*.test.ts` ignored. `tests/integration/` is empty.

## Git Hooks & Release

- Husky `pre-commit` (`.husky/pre-commit:1`): `bun run format` only. `commit-msg`: `commitlint --edit` with `.commitlintrc.json:4` `type-enum: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip`.
- Changesets (`.changeset/config.json`): `baseBranch: main`, `access: public`, `commit: false`. `bun run version`. `release.yml:26` on `main`: `bun install --frozen-lockfile` → `check:lint` + `check:types` → `changesets/action@v1` (`publish: bun run release`), needs `NPM_TOKEN`.
