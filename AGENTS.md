# AGENTS.md

## Project

`@adityab/conform` — CLI tool that checks repositories against conformance templates. Bun + TypeScript, ESM (`"type": "module"`). Published as raw TS source (no build step, `noEmit: true`).

## Commands

- **Install:** `bun install`
- **Lint & format:** `bun run check:lint` (runs `biome check --fix .`)
- **Typecheck:** `bun run check:types` (runs `tsc --noEmit`)
- **Run CLI:** `bun run src/cli.ts check [--path <dir>] [--json] [-v]`

Always run `check:lint` before `check:types`.

## Architecture

- `src/cli.ts` — CLI entrypoint (`bin.conform`). Uses `commander`. Supports `check --path <dir> --json -v/--verbose`.
- `src/commands/check.ts` — Orchestrates config load → template resolution → engine → reporter. Exit codes: 0=pass, 1=fail, 2=warn.
- `src/index.ts` — Package API. Re-exports `defineConfig`, `defineTemplate`, `rule` + types.
- `src/template-api/index.ts` — Builder functions (`defineConfig`, `defineTemplate`, `rule`).
- `src/config/load.ts` — Loads `conform.config.ts` from target dir via dynamic import.
- `src/engine/index.ts` — Iterates template rules, collects `RuleResult[]`.
- `src/context.ts` — Builds `CheckContext` with cached file reads, JSON parsing (strips `//` and `/* */` comments).
- `src/registry.ts` — Resolves templates by **directory name** under `templates/`, not by `template.name`. Config value `template: "npm-pkg"` → looks up `templates/npm-pkg/index.ts`.
- `src/types.ts` — All shared types.
- `src/reporter/` — `tui.ts` (human-readable), `json.ts` (machine-readable). Both hide passing results unless `--verbose`; summary counts always reflect all results.

## Templates

Built-in template packs in `templates/`. Each is a directory with `index.ts` exporting a `defineTemplate()` default.

| Directory | Template `name` | Status |
|-----------|----------------|--------|
| `npm-pkg/` | `npm-publish` | Complete (package.json, husky, biome, typescript, files, JSR rules) |
| `astro-site/` | — | Empty placeholder |
| `monorepo/` | — | Empty placeholder |
| `react-site/` | — | Empty placeholder |
| `webapp/` | — | Empty placeholder |

Templates import from `../../src/template-api.ts` (direct source, not the package export). Adding a new template = create `templates/<name>/index.ts` with a `defineTemplate()` default export — no registration step.

## Toolchain

- **Runtime:** Bun only (not Node). Types from `@types/bun`. `import.meta.dir` for path resolution.
- **Linter/formatter:** Biome 2.x (no config file — defaults only). No ESLint or Prettier.
- **TypeScript:** `^7.0.1-rc` (peer dep). Strict + `noUncheckedIndexedAccess` + `noImplicitOverride`. `noUnusedLocals`/`noUnusedParameters` disabled. `bundler` resolution with `allowImportingTsExtensions` + `verbatimModuleSyntax`.
- **CLI parsing:** `commander` (runtime dep).
- No tests. No CI. No build step.

## Git Hooks (Husky)

- **pre-commit:** `bunx biome format --write .` (format only, not full `biome check`)
- **commit-msg:** Conventional Commits — `<type>(<scope>)!: <description>`. Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, **wip**.

## Key Patterns

- `conform.config.ts` at repo root dogfoods the `npm-pkg` template.
- Rule IDs use colon-separated namespacing: `"group:short-name"` (e.g. `"package-json:name"`, `"jsr:no-slow-types"`).
- Adding a rule = call `rule()` with `id`, `group`, `description`, `severity` (`"warn"` | `"fail"`), and `check` returning `{ status, message? }`.
- `docs/adr/` contains architecture decision records. `docs/CONTEXT.md` has the domain model and design principles.
