# AGENTS.md

## Project

`@adityab/conform` — CLI that checks repositories against conformance templates. Bun + TypeScript, ESM (`"type": "module"`). Published as raw TS source: no build step (`noEmit: true`), `exports: "." → ./src/index.ts`, `files: ["src", "templates"]`.

## Commands

- **Install:** `bun install`
- **Lint & format:** `bun run check:lint` (`biome check . --fix`)
- **Typecheck:** `bun run check:types` (`tsc --noEmit`)
- **Run CLI:** `bun run src/cli.ts check [--path <dir>] [--json] [-v] [--group domains|files]`
- **Test (all):** `bun run test` (`vitest run`)
- **Test (unit):** `bun run test:unit` — excludes only `tests/e2e/**` (integration still runs)
- **Test (integration):** `bun run test:integration` (`--passWithNoTests`; dir currently empty)
- **Test (e2e):** `bun run test:e2e`
- **Test (watch):** `bun run test:watch`
- **Changeset:** `bun run changeset` · **Version:** `bun run version` · **Publish:** `bun run release`

Required order: `check:lint` → `check:types` → `test`. `CONTRIBUTING.md` requires all three green before PR; the release CI runs `check:lint` + `check:types` only.

## Release flow (Changesets)

`.changeset/config.json`: `baseBranch: main`, `access: public`, `commit: false`, changelog via `@changesets/changelog-git`. `bun run version` = `changeset version` then `scripts/ensure-unreleased.ts`, which injects a `## Unreleased` header into `CHANGELOG.md` if missing. `.github/workflows/release.yml` runs on push to `main`: lint + typecheck, then `changesets/action@v1` opens a "version packages" PR; merging that PR runs `bun run release` to publish. Publishing needs `NPM_TOKEN` (`.npmrc` → `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`).

## Architecture

- `src/cli.ts` — `commander` entrypoint (`bin.conform`). `check` options: `--path` (default cwd), `--json`, `-v/--verbose`, `--group domains|files`. `--json` + `--group` together → exit 1.
- `src/commands/check.ts` — `loadConfig → resolver → createCheckContext → runChecks → exit code`. Exit codes: 0 pass, 1 fail, 2 warn (also used for no-config / template-not-found).
- `src/config/load.ts` — dynamic-imports `conform.config.ts` from the target dir.
- `src/conform-api/resolver.ts` — resolves a template by name. Currently looks up `templates/<name>/index.ts` (directory-based).
- `src/conform-api/index.ts` — `defineConfig`, `defineTemplate`, `rule`, `domain`.
- `src/engine/index.ts` — iterates `template.rules`, calls `rule.check(ctx)`, collects `RuleResult[]`.
- `src/context.ts` — `createCheckContext`: cached file reads; `readJson` strips `//` and `/* */` comments as a fallback parse.
- `src/reporter/` — `tui.ts` (ANSI, human) and `json.ts` (machine). Both hide `pass` results unless `--verbose`; summary counts always reflect all results. Support `groupBy: "domains" | "files"`.
- `src/index.ts` — package API: re-exports `defineConfig`, `defineTemplate`, `rule`, `domain` + types.
- `src/types.ts` — all shared types.

### Current gotcha (mid-refactor)

Templates on disk are flat files `templates/<name>.ts`, but `resolver.ts` still expects `templates/<name>/index.ts`. So `bun run src/cli.ts check` against the dogfood config (`conform.config.ts` → `template: "package"`) currently exits 2 with no output — the resolver returns null. Also, `CheckCommand` does not yet call `renderTui`/`renderJson` (reporters are implemented but not wired into the command). Expect both when verifying changes.

## Rule & template API

- `rule({ id, domain, files, description, check })` — no `group`, no `severity` field. `check(ctx)` returns `{ status: "pass" | "warn" | "fail", message? }`; `status` IS the severity.
- `domain(name)` returns a builder whose `.rule(...)` injects that domain.
- Rule IDs are colon-namespaced `"domain:short-name"` (e.g. `package-json:type-module`, `biome:config-file`, `jsr:no-slow-types`, `github:ci-workflow`). The TUI shows only the segment after the last `:`.
- `CheckContext` exposes `fileExists`, `readFile`, `readJson`, `packageJson`, `targetPath`.

## Templates

Flat `.ts` files in `templates/`, each a `defineTemplate()` default export importing from `@/conform-api/index.ts`:

| File | `name` | Status |
|------|--------|--------|
| `package.ts` | `npm-publish` | Complete (~58 rules across 9 domains) |
| `astro-site.ts`, `monorepo.ts`, `react-site.ts`, `webapp.ts` | — | Empty placeholders (0 bytes) |

Adding a template = create `templates/<name>.ts` with a `defineTemplate()` default export (no registration step). Note the resolver mismatch above.

## Toolchain

- **Runtime:** Bun only (not Node). `@types/bun`; `import.meta.dir` for path resolution.
- **Biome 2.x** with explicit `biome.json`: all-rule presets on for a11y/complexity/correctness/performance/security/style/suspicious; formatter = 2-space, double quotes, LF, width 80; `organizeImports` with custom groups; VCS git integration. No ESLint/Prettier.
- **TypeScript** `^7.0.1-rc` (peer dep). Notable strict flags: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `moduleResolution: bundler`, `allowImportingTsExtensions`, `composite` + `incremental` (emits `tsconfig.tsbuildinfo`), `noEmit: true`. Path alias `@/*` → `./src/*` (tsconfig + vitest config).
- **Test runner:** Vitest (`vitest.config.ts`): alias `@` → `src`, includes `tests/**/*.test.ts`.
- **CLI parsing:** `commander`.

## Git hooks (Husky)

- **pre-commit:** `bunx biome format --write .` (format only — not full `biome check`).
- **commit-msg:** Conventional Commits regex `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip)(\(.+\))?!?: .{1,100}`. `wip` is an allowed type and the description is capped at 100 chars.

## Env

`.env.example` declares `NPM_TOKEN` (used by `.npmrc` for publishing) and `CONFORM_AI_API_KEY` (declared but not yet referenced in `src/`; tied to the planned AI-rules feature in `docs/adr/003-deterministic-and-ai-rules.md`).

## Docs

`docs/CONTEXT.md` (domain model), `docs/glossary.md`, `docs/adr/` (ADRs), `docs/plans/`. `conform.config.ts` at repo root dogfoods the `package` template.
