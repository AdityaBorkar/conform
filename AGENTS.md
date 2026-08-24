# AGENTS.md

## Project

`@adityab/conform` — CLI that checks repos against conformance presets. Bun + TypeScript, ESM (`"type": "module"`). No build: `noEmit: true`, published as raw TS via `exports: "." → ./src/index.ts` (`src/index.ts:1`). `files: ["src","templates"]` lists `templates/` which does not exist — presets live in `src/presets/`.

## Commands

- Install: `bun install` (`bunfig.toml:14` `ignore-scripts=true`, `minimumReleaseAge=259200` = 3d)
- Lint: `bun run check:lint` (`biome check . --fix`)
- Typecheck: `bun run check:types` (`tsc --noEmit`)
- CLI: `bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]` — not `src/cli.ts`
- Tests: `bun run test` (`vitest run`) · `bun run test:unit` (`--exclude 'tests/e2e/**'`) · `bun run test:e2e` · `bun run test:integration` (`--passWithNoTests`, empty) · `bun run test:watch` (`vitest`)
- Single test: `bun run test tests/e2e/check.test.ts` or `bunx vitest run tests/e2e/check.test.ts -t "<name>"`
- Changeset: `bun run changeset` · Version: `bun run version` (`changeset version && scripts/ensure-unreleased.ts`) · Publish: `bun run release`

Required order: `check:lint` → `check:types` → `test`. CI (`release.yml:24`) runs only `check:lint` + `check:types`.

> `CONTRIBUTING.md:19,22` says `bun test` and `bun run src/cli.ts check` — both wrong. Use `bun run test` and `src/cli/index.ts`.

## Architecture

- `src/cli/index.ts:10` — `commander` entrypoint; `src/cli/check.ts:35` — `loadConfig → resolver → mergeTemplateWithConfig → runChecks → exit code` (0 pass, 1 fail, 2 warn/no-config/template-not-found). Rejects `--json`+`--group` together (exit 1).
- `src/utils/config.ts:8` — dynamic-imports `conform.config.ts` from target dir, requires `config.template: string`.
- `src/api/resolver.ts:7,32` — resolves `templates/<name>.ts` or `templates/<name>/index.ts` at repo root; `src/presets/` is ignored.
- `src/api/engine.ts:28` — flattens `template.plugins[].rules`, applies `template.rules` overrides (`RuleOverrides`: `"off"` skips, `"warn"/"error"/"fail"` coerce non-pass, `["warn", ...opts]` supported), calls `rule.check(targetPath: string)`.
- `src/utils/fs.ts` — `fileExists`, `readFile`, `readJson` (strips `//`/`/* */`), `packageJson`. Rules receive `string` path, not `Target` object.
- `src/cli/reporter/tui.ts:106` + `json.ts:3` — hide `pass` unless `verbose`; summary counts always include all. `groupBy` default `domains`.
- `src/api/index.ts:8` — re-exports `defineConfig`, `definePlugin`/`Plugin`/`RuleSet` (alias), `defineRule`, `defineTemplate`/`defineTemplateLegacy`, `Status`.
- `src/types.ts:1,45,51,58,67` — `Severity`, `Rule { id, domain, files, description, check(ctx: string) }`, `Plugin { id, rules }`, `Template { name, description, plugins, rules? }`, `ConformConfig`, `ConformOutput`.
- Presets: `src/presets/*.ts` (default export `defineTemplate`). Plugins: `src/inbuilt-plugins/*.ts`. Only `package` is complete (13 plugins); `astro-site`, `monorepo`, `react-site`, `webapp` are stubs (`plugins: []`).

## Gotchas

1. **Bin + version broken** — `package.json:8` `bin.conform` points to `src/cli.ts` (missing); `src/cli/index.ts:11` reads `join(import.meta.dir, "..", "package.json")` → `src/package.json` `ENOENT` (needs `../..`). `bun run src/cli/index.ts check` crashes before checks.
2. **Resolver mismatch** — `resolver.ts:7` looks in `templates/` (nonexistent). Dogfood `conform.config.ts:4` (`template: "package"`) always returns `null` → exit 2.
3. **Reporters not wired** — `src/cli/check.ts` computes `results` but never calls `renderTui`/`renderJson`; no stdout, only exit code.
4. **Tests location** — `vitest.config.ts:12` `include: ["tests/**/*.test.ts"]` only; colocated `src/**/*.test.ts` ignored.
5. **Stale names** — `Target`/`CheckContext` removed; `RuleSet` → `Plugin` (alias kept); `templates/rules/` → `src/inbuilt-plugins/`.

## Rule & Preset API

- `definePlugin({ id, domain?, context: (targetPath) => T })` + `.defineRule({ id, name, domain?, files?, test: ({context: T}) => CheckResult })` (`src/api/plugin.ts:18,27`). IDs namespaced `pluginId:ruleId`. Prefer `definePlugin` over class.
- `defineRule({ id, domain, files, description, check: (targetPath: string) => CheckResult })` — standalone.
- `Status.pass/warn/fail(message?)` → `{ status, message? }`.
- `defineTemplate({ name, description, plugins, rules? })` — `rules` is oxc-style `Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>` where `RuleSeverity = "pass"|"warn"|"fail"|"off"|"error"` (`"error"` → `"fail"`).
- Domains: `src/inbuilt-plugins/utils/domain.ts` — `STYLE`, `BUILD`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `TESTING`.

## Toolchain

- Bun only; `import.meta.dir` for paths. Alias `@/*` → `./src/*` (`tsconfig.json:31`, `vitest.config.ts:8`).
- Biome 2.x (`biome.json:3` preset `all`): 2-space/double-quotes/LF/width 80, `organizeImports` groups, `vcs: git`. Overrides: `noDefaultExport: off`, `useNamingConvention: off`, `noSecrets: off`. No ESLint/Prettier.
- TypeScript `^7.0.1-rc` strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `noEmit`.
- `arktype` for validation in plugins.

## Git Hooks & Release

- Husky `pre-commit` (` .husky/pre-commit:1`): `bunx biome format --write .` (format only). `commit-msg`: `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip)(\(.+\))?!?: .{1,100}` — `wip` allowed, 100 chars.
- Changesets (` .changeset/config.json`): `baseBranch: main`, `access: public`, `commit: false`. `bun run version` injects `## Unreleased` via `scripts/ensure-unreleased.ts:13`. `release.yml:29` on `main`: `bun install --frozen-lockfile` → `check:lint` + `check:types` → `changesets/action@v1` (`publish: bun run release`, `version: bun run version`), needs `NPM_TOKEN`.
