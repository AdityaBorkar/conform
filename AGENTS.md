# AGENTS.md

## Project

`@adityab/conform` — CLI that checks repos against conformance presets. Bun + TypeScript, ESM (`"type": "module"`). Published as raw TS: no build, `noEmit: true`, `exports: "." → ./src/index.ts`. Listed `files: ["src","templates"]` but `templates/` does not exist — presets live in `src/presets/`.

## Commands

- Install: `bun install` (respects `bunfig.toml`: `ignore-scripts=true`, `minimumReleaseAge=3d`)
- Lint & format: `bun run check:lint` (`biome check . --fix`)
- Typecheck: `bun run check:types` (`tsc --noEmit`)
- Run CLI: `bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]` (not `src/cli.ts`)
- Tests: `bun run test` (`vitest run`) · `bun run test:unit` (excludes `tests/e2e/**`) · `bun run test:integration` (`--passWithNoTests`, empty) · `bun run test:e2e` · watch `bun run test:watch`
- Changeset: `bun run changeset` · Version: `bun run version` · Publish: `bun run release`

Required order: `check:lint` → `check:types` → `test`. Release CI (`release.yml`) runs only `check:lint` + `check:types`.

**Gotcha:** `CONTRIBUTING.md` says `bun test` — correct is `bun run test` (vitest, not Bun runner). `vitest.config.ts` includes only `tests/**/*.test.ts`; colocated `src/**/*.test.ts` are ignored.

## Architecture

- `src/cli/index.ts` — `commander` entrypoint (`bin.conform` declares `src/cli.ts` which does not exist; use `src/cli/index.ts`). Package version read via `join(import.meta.dir, "..", "package.json")` is broken (resolves to `src/package.json`); needs `../..`.
- `src/cli/check.ts` — `loadConfig → resolver → mergeTemplateWithConfig → runChecks → exit code`. Exit codes: 0 pass, 1 fail, 2 warn/no-config/template-not-found. Rejects `--json` + `--group` together (exit 1). Reporters never called (see gotchas).
- `src/utils/config.ts` — dynamic-imports `conform.config.ts` from target dir; requires `config.template` string.
- `src/api/resolver.ts` — resolves by name from `templates/<name>.ts` or `templates/<name>/index.ts` at repo root — but `templates/` does not exist (presets are in `src/presets/`), so every lookup returns `null`.
- `src/api/engine.ts` — flattens `template.plugins[].rules`, applies `template.rules` overrides (`RuleOverrides`: `"off"` skips, `"warn"/"error"/"fail"` coerce non-pass, tuple `["warn", ...opts]` supported), calls `rule.check(targetPath)`.
- `src/utils/fs.ts` — `fileExists`, `readFile`, `readJson` (strips `//` and `/* */` comments), `packageJson`. No `Target` object — rules receive `targetPath: string`.
- `src/cli/reporter/tui.ts` + `json.ts` — hide `pass` unless `verbose`; summary counts always include all. `groupBy: "domains"|"files"` (default `domains`). `json.ts` outputs `ConformOutput`.
- `src/api/index.ts` — re-exports `defineConfig`, `definePlugin`/`Plugin`/`RuleSet` (alias), `defineRule`, `defineTemplate`/`defineTemplateLegacy`, `Status` + types.
- `src/types.ts` — `Severity: "pass"|"warn"|"fail"`, `Rule { id, domain, files, description, check(ctx: string) }`, `Plugin { id, rules }`, `RuleOverrides`, `Template { name, description, plugins, rules? }`, `RuleResult`, `ConformConfig`, `ConformOutput`.

## Gotchas (verify before fixing)

1. **Bin + version path broken:** `package.json` bin `src/cli.ts` missing; `src/cli/index.ts:11` reads `../package.json` (should be `../../package.json`). `bun run src/cli/index.ts check` crashes with `ENOENT` before reaching checks.
2. **Resolver mismatch:** `resolver.ts` looks in `templates/` (nonexistent). Dogfood `conform.config.ts` (`template: "package"`) always fails with exit 2. Fix: point resolver at `src/presets/` or add `templates/` shim.
3. **Reporters not wired:** `CheckCommand` computes `results` but never calls `renderTui`/`renderJson`; only exit code varies, no stdout.
4. **Old doc names stale:** `Target`/`CheckContext` no longer exists; `RuleSet` is now `Plugin` (alias kept); `templates/rules/` is now `src/inbuilt-plugins/`.

## Rule & preset API

- `Plugin`/`RuleSet`: `new Plugin({ id, domain?, context: (targetPath) => T })` + `.defineRule({ id, name, domain?, files?, test: ({context: T}) => CheckResult })`. IDs namespaced as `pluginId:ruleId`. `definePlugin` helper is preferred for new code.
- `defineRule({ id, domain, files, description, check })` — standalone, `check: (targetPath: string) => CheckResult`.
- `Status.pass/warn/fail(message?)` → `{ status, message? }`; `status` is the severity.
- `defineTemplate({ name, description, plugins, rules? })` — `rules` is an oxc-style override map `Record<string, RuleSeverity | [RuleSeverity, ...unknown[]]>` where `RuleSeverity = "pass"|"warn"|"fail"|"off"|"error"` (`"error"` → `"fail"`).
- Domains in `src/inbuilt-plugins/utils/domain.ts`: `STYLE`, `BUILD`, `CODE_QUALITY`, `DEV_ENVIRONMENT`, `DOCUMENTATION`, `GITHUB_CONFIG`, `OBSERVABILITY`, `SECURITY`, `TESTING`.

## Presets

Flat files in `src/presets/` (`defineTemplate` default export). Plugins in `src/inbuilt-plugins/` (one file per domain + `utils/`). Only `package` is complete (~13 plugins); `astro-site`, `monorepo`, `react-site`, `webapp` are empty (`plugins: []`). Adding a preset: create `src/presets/<name>.ts` (resolver will need updating).

## Toolchain

- Runtime: Bun only; `import.meta.dir` for paths. Path alias `@/*` → `./src/*` (tsconfig + vitest).
- Biome 2.x (`biome.json`): presets `all`, 2-space/double-quotes/LF/width 80, `organizeImports` groups, `vcs` git. Overrides: `noDefaultExport: off`, `useNamingConvention: off`, `noSecrets: off`. No ESLint/Prettier.
- TypeScript `^7.0.1-rc` strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `noEmit`.
- `arktype` for structural validation in plugins (e.g. `package_json.ts`).

## Git hooks & release

- Husky `pre-commit`: `bunx biome format --write .` (format only, not `biome check`). `commit-msg`: regex `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip)(\(.+\))?!?: .{1,100}` — `wip` allowed, description 100 chars max.
- Changesets: `baseBranch: main`, `access: public`, `commit: false`, changelog `changelog-git`. `bun run version` runs `changeset version && scripts/ensure-unreleased.ts` (injects `## Unreleased` in `CHANGELOG.md`). `release.yml` on `main`: `bun install --frozen-lockfile` → `check:lint` + `check:types` → `changesets/action@v1` (`publish: bun run release`, `version: bun run version`). Needs `NPM_TOKEN`.
