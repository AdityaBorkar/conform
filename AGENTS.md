# AGENTS.md

## Project

`@adistack/conform` — CLI that checks repos against conformance presets. Bun + TypeScript, ESM (`"type": "module"`). No build: `noEmit: true`, published as raw TS via `exports: "." → ./src/index.ts` (`src/index.ts:1`). `files: ["src"]`

## Commands

- Install: `bun install` (`bunfig.toml:14` `ignore-scripts=true`, `minimumReleaseAge=259200`=3d)
- Lint: `bun run check:lint` (`biome check . --fix`) · Format: `bun run format`
- Typecheck: `bun run check:types` (`tsc --noEmit`)
- CLI: `bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]` (also `src/cli.ts` re-exports it; `package.json:8` bin is `src/cli.ts`)
- Tests: `bun run test` (`vitest run`) · `bun run test:unit` (`--exclude 'tests/e2e/**'`) · `bun run test:e2e` · `bun run test:integration` (`--passWithNoTests`, empty) · `bun run test:watch` (`vitest`)
- Single test: `bun run test tests/e2e/check.test.ts` or `bunx vitest run tests/e2e/check.test.ts -t "<name>"`
- Changeset: `bun run changeset` · Version: `bun run version` (`changeset version && scripts/ensure-unreleased.ts`) · Publish: `bun run release`

Required order: `check:lint` → `check:types` → `test`. CI (`release.yml:24`) runs only `check:lint` + `check:types` before `changesets/action`.

## Architecture

- `src/cli/index.ts:10` — `commander` entrypoint (`bin` + `version` from `../../package.json`); `src/cli/check.ts:7` — validates `--json`+`--group` conflict (exit 1), calls `check()` → writes `result.rendered` → exit 0 pass / 1 fail / 2 warn-or-error.
- `src/api/conformance.ts:69` — `loadConfig → presetResolver → mergePresetWithConfig → runChecks → renderTui/renderJson`. `output.results` hides `pass` unless `verbose`; `summary` always counts all.
- `src/utils/config.ts:8` — dynamic-imports `conform.config.ts` from target dir, requires `config.preset: string` (not `preset`).
- `src/api/preset.ts:24` — resolves `src/presets/<name>.ts` or `src/presets/<name>/index.ts` at repo root. Dogfood `conform.config.ts:4` uses `preset: "package"`.
- `src/api/engine.ts:30` — flattens `preset.plugins[].rules`, applies `preset.rules` overrides (`RuleOverrides`: `"off"` skips, `"warn"/"error"/"fail"` coerce non-pass, `["warn", ...opts]` passes `opts[0]` as params), calls `rule.check(targetPath: string, params?)`.
- `src/types.ts:36` — `Rule { id, domain, files, description, check(ctx: string) }`, `Plugin { id, rules }`, `Preset { name, description, plugins, rules? }` (`preset` is deprecated alias), `ConformConfig { preset, plugins?, rules? }`.
- `src/api/index.ts:8` — re-exports `defineConfig`, `definePlugin`/`Plugin`/`RuleSet` (alias), `defineRule`, `definePreset`/`definepreset` (alias), `presetResolver`/`resolver` (alias), `Status`.
- Presets: `src/presets/*.ts` (default export `definePreset`). Plugins: `src/plugins/*.ts`. Only `package` is complete (12 plugins); `astro-site`, `monorepo`, `react-site`, `webapp` are stubs (`plugins: []`).

## Rule & Preset API

- `definePlugin({ id, domain, context: (target: Target | string) => T })` + `.defineRule({ id, name, domain, files?, params?, test: ({context: T, params?}) => CheckResult })` (`src/api/plugin.ts:19,27`). IDs namespaced `pluginId:ruleId`.
- `defineRule({ id, domain, files, description, check: (targetPath: string, params?) => CheckResult, params? })` — standalone, arktype `params` validated before call.
- `Status.pass/warn/fail(message?)` → `{ status, message? }`.
- `definePreset({ name, description, plugins, rules? })` — `rules` is `Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>` where `RuleSeverity = "pass"|"warn"|"fail"|"off"|"error"` (`"error"` → `"fail"`).
- Domains: `src/plugins/utils/domain.ts` — `STYLE`, `BUILD`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `TESTING`.

## Toolchain

- Bun only; `import.meta.dir` for paths. Alias `@/*` → `./src/*` (`tsconfig.json:31`, `vitest.config.ts:8`).
- Biome 2.x (`biome.json:3` preset `all`): 2-space/double-quotes/LF/width 80, `organizeImports` groups, `vcs: git`. Overrides: `noDefaultExport: off`, `useNamingConvention: off`, `noSecrets: off`. No ESLint/Prettier.
- TypeScript `^7.0.2` strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `noEmit`.
- `arktype` for rule param validation.

## Gotchas

- `CONTRIBUTING.md:19` says `bun test` — wrong, use `bun run test` (vitest). `CONTRIBUTING.md:22` `bun run src/cli.ts check` now works (re-export) but canonical entry is `src/cli/index.ts`.
- `README.md:37,48` uses `preset: "npm-pkg"` — stale; field is `preset`, value is `"package"` (`conform.config.ts:4`). `README` programmatic import `rule` is alias for `defineRule`.
- `vitest.config.ts:12` `include: ["tests/**/*.test.ts"]` only — colocated `src/**/*.test.ts` ignored.
- `package.json:37` `files: ["src"]` 
- Stale names: `preset` → `Preset` (alias kept), `resolver` → `presetResolver` (alias kept), `RuleSet` → `Plugin` (alias kept), `presets/rules/` → `src/plugins/`.

## Git Hooks & Release

- Husky `pre-commit` (`.husky/pre-commit:1`): `bun run format` (format only). `commit-msg`: `commitlint --edit` with `.commitlintrc.json:4` `type-enum: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip` (100 chars via conventional).
- Changesets (`.changeset/config.json`): `baseBranch: main`, `access: public`, `commit: false`. `bun run version` injects `## Unreleased` via `scripts/ensure-unreleased.ts:13`. `release.yml:29` on `main`: `bun install --frozen-lockfile` → `check:lint` + `check:types` → `changesets/action@v1` (`publish: bun run release`, `version: bun run version`), needs `NPM_TOKEN`.
