# AGENTS.md

## Project

`@adityab/conform` — CLI that checks repositories against conformance templates. Bun + TypeScript, ESM (`"type": "module"`). Published as raw TS source: no build step (`noEmit: true`), `exports: "." → ./src/index.ts`, `files: ["src", "templates"]`.

## Commands

- **Install:** `bun install`
- **Lint & format:** `bun run check:lint` (`biome check . --fix`)
- **Typecheck:** `bun run check:types` (`tsc --noEmit`)
- **Run CLI:** `bun run src/cli.ts check [--path <dir>] [--json] [-v] [--group domains|files]`
- **Test (all):** `bun run test` (`vitest run`)
- **Test (unit):** `bun run test:unit` — excludes only `tests/e2e/**`
- **Test (integration):** `bun run test:integration` (`--passWithNoTests`; dir currently empty)
- **Test (e2e):** `bun run test:e2e`
- **Test (watch):** `bun run test:watch`
- **Changeset:** `bun run changeset` · **Version:** `bun run version` · **Publish:** `bun run release`

Required order: `check:lint` → `check:types` → `test`. `CONTRIBUTING.md` requires all three green before PR; the release CI runs `check:lint` + `check:types` only.

**Gotcha:** `CONTRIBUTING.md` says `bun test` but the correct command is `bun run test` (vitest, not Bun's built-in runner).

**Gotcha:** Vitest config (`vitest.config.ts`) includes only `tests/**/*.test.ts`. Test files colocated in `src/` (e.g. `src/engine/engine.test.ts`, `src/target.test.ts`) are **not** picked up by `bun run test`.

## Architecture

- `src/cli.ts` — `commander` entrypoint (`bin.conform`). `check` options: `--path` (default cwd), `--json`, `-v/--verbose`, `--group domains|files`. `--json` + `--group` together → exit 1.
- `src/commands/check.ts` — `loadConfig → resolver → createTarget → runChecks → exit code`. Exit codes: 0 pass, 1 fail, 2 warn (also used for no-config / template-not-found).
- `src/config/load.ts` — dynamic-imports `conform.config.ts` from the target dir.
- `src/conform-api/resolver.ts` — resolves a template by name. Currently looks up `templates/<name>/index.ts` (directory-based).
- `src/conform-api/index.ts` — `defineConfig`, `defineTemplate`, `defineRule`, `RuleSet`, `Status`.
- `src/engine/index.ts` — iterates `template.rules`, calls `rule.check(target)`, collects `RuleResult[]`.
- `src/target.ts` — `createTarget`: cached file reads; `readJson` strips `//` and `/* */` comments as a fallback parse. Returns a `Target` object (not `CheckContext` — that name is stale).
- `src/reporter/` — `tui.ts` (ANSI, human) and `json.ts` (machine). Both hide `pass` results unless `--verbose`; summary counts always reflect all results. Support `groupBy: "domains" | "files"`.
- `src/index.ts` — package API: re-exports `defineConfig`, `defineTemplate`, `rule` (alias for `defineRule`), `RuleSet`, `Status` + types.
- `src/types.ts` — all shared types. `Target` is the context interface passed to rule checks.

### Current gotchas (mid-refactor)

1. **Resolver mismatch:** Templates on disk are flat files `templates/<name>.ts`, but `resolver.ts` still expects `templates/<name>/index.ts`. So `bun run src/cli.ts check` against the dogfood config (`conform.config.ts` → `template: "package"`) currently exits 2 with no output — the resolver returns null.

2. **Reporters not wired:** `CheckCommand` does not yet call `renderTui`/`renderJson`. Results are computed but never displayed; only the exit code varies.

## Rule & template API

- **`RuleSet`** — primary way to define rules. Constructor takes `{ id, domain?, context: (target) => T }`. Call `.defineRule({ id, name, domain?, files?, test })` to add rules. `.rules` getter produces `Rule[]` with IDs namespaced as `RuleSet.id:ruleDef.id`.
- **`defineRule`** (exported as `rule`) — standalone rule definition: `{ id, domain, files, description, check }`.
- **`Status`** — helper factories: `Status.pass()`, `Status.warn()`, `Status.fail()`, each taking an optional message.
- **`defineTemplate`** — identity function for type safety: `{ name, description, rules }`.
- `check(ctx)` / `test({ context })` returns `{ status: "pass" | "warn" | "fail", message? }`; `status` IS the severity — no separate `severity` field.
- `Target` exposes `fileExists`, `readFile`, `readJson`, `packageJson`, `targetPath`.
- Domains defined in `templates/rules/utils/domain.ts` as human-readable labels (e.g. `"Style & Validation"`, `"Build & Tasks"`). RuleSet `.domain` defaults to `DOMAIN.STYLE` but can be overridden per-RuleSet or per-rule.

## Templates

Flat `.ts` files in `templates/`, each a `defineTemplate()` default export. Rules live in `templates/rules/` as `RuleSet` modules (one file per domain, e.g. `biome.ts`, `tsconfig.ts`, `package_json.ts`). Shared helpers in `templates/rules/utils/`.

| Template file | `name` | Status |
|---------------|--------|--------|
| `package.ts` | `package` | Complete (~58 rules across 13 RuleSets) |
| `astro-site.ts`, `monorepo.ts`, `react-site.ts`, `webapp.ts` | — | Empty placeholders |

Adding a template = create `templates/<name>.ts` with a `defineTemplate()` default export (no registration step). Note the resolver mismatch above.

## Toolchain

- **Runtime:** Bun only (not Node). `import.meta.dir` for path resolution.
- **Biome 2.x** with explicit `biome.json`: all-rule presets on; formatter = 2-space, double quotes, LF, width 80; `organizeImports` with custom groups; VCS git integration. Notable overrides: `noDefaultExport: off`, `useNamingConvention: off`, `noSecrets: off`. No ESLint/Prettier.
- **TypeScript** `^7.0.1-rc` (peer dep). Very strict: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noEmit: true`. Path alias `@/*` → `./src/*` (tsconfig + vitest config).
- **Test runner:** Vitest (`vitest.config.ts`): alias `@` → `src`, includes `tests/**/*.test.ts`.
- **CLI parsing:** `commander`.
- **Validation:** `arktype` used in rule files for structural checks (e.g. `package_json.ts`).

## Git hooks (Husky)

- **pre-commit:** `bunx biome format --write .` (format only — not full `biome check`).
- **commit-msg:** Conventional Commits regex `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip)(\(.+\))?!?: .{1,100}`. `wip` is an allowed type and the description is capped at 100 chars.

## Release flow (Changesets)

`.changeset/config.json`: `baseBranch: main`, `access: public`, `commit: false`, changelog via `@changesets/changelog-git`. `bun run version` = `changeset version` then `scripts/ensure-unreleased.ts`, which injects a `## Unreleased` header into `CHANGELOG.md` if missing. `.github/workflows/release.yml` runs on push to `main`: lint + typecheck, then `changesets/action@v1` opens a "version packages" PR; merging that PR runs `bun run release` to publish. Publishing needs `NPM_TOKEN` (`.npmrc` → `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`).

## Env

`.env.example` declares `NPM_TOKEN` (used by `.npmrc` for publishing) and `CONFORM_AI_API_KEY` (declared but not yet referenced in `src/`; tied to the planned AI-rules feature in `docs/adr/003-deterministic-and-ai-rules.md`).
