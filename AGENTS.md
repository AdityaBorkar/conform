# AGENTS.md

## Project

`@adityab/conform` — CLI tool that checks repositories against conformance templates. Bun + TypeScript, ESM (`"type": "module"`).

## Commands

- **Install:** `bun install`
- **Lint & format:** `bun run check:lint` (runs `biome check --fix .`)
- **Typecheck:** `bun run check:types` (runs `tsc --noEmit`)
- **Run CLI:** `bun run src/cli.ts check [--path <dir>] [--json]`
- **Run CLI (installed):** `conform check [--path <dir>] [--json]`

Always run `check:lint` before `check:types`.

## Architecture

- `src/cli.ts` — CLI entrypoint (`bin.conform` in package.json). Parses args, loads config, resolves template, runs checks, renders output. Exit codes: 0=pass, 1=fail, 2=warn or bad usage.
- `src/index.ts` — Package API entrypoint. Re-exports `defineConfig`, `defineTemplate`, `rule` and related types.
- `src/template-api.ts` — Public builder functions (`defineConfig`, `defineTemplate`, `rule`).
- `src/config.ts` — Loads `conform.config.ts` from target directory via dynamic import.
- `src/registry.ts` — Discovers templates from `templates/<name>/index.ts` via filesystem scan + dynamic import. Template name comes from `template.name`, not directory name.
- `src/engine.ts` — Iterates template rules, collects results.
- `src/context.ts` — Builds `CheckContext` with cached file reads and `package.json` parsing (strips JSON comments).
- `src/types.ts` — All shared types.
- `src/reporter/` — `tui.ts` (human-readable), `json.ts` (machine-readable).
- `templates/` — Built-in template packs. Each is a directory with `index.ts` exporting a `defineTemplate()` result. Current: `npm-publish`.
- `conform.config.ts` — Dogfooding config at repo root (uses `npm-publish` template).
- `src/commands/`, `src/lib/` — Placeholder directories, currently empty.

## Toolchain

- **Runtime:** Bun (not Node). Types from `@types/bun`. `import.meta.dir` used for path resolution.
- **Linter/formatter:** Biome 2.x (no `biome.json` — defaults only). No ESLint or Prettier.
- **TypeScript:** `^7.0.1-rc` (peer dep). Strict mode with `noUncheckedIndexedAccess` and `noImplicitOverride` enabled; `noUnusedLocals`/`noUnusedParameters` disabled.
- **Module resolution:** `bundler` mode with `allowImportingTsExtensions` and `verbatimModuleSyntax`.
- No build step (`noEmit: true`). No tests yet. No CI.

## Git Hooks (Husky)

- **pre-commit:** `bunx biome check --write src/`
- **commit-msg:** Conventional Commits enforced — `<type>(<scope>)!: <description>` (types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert).

## Key Patterns

- Templates import `defineTemplate`/`rule` from `../../src/template-api.ts` (direct source, not the package export).
- Adding a new template = create `templates/<name>/index.ts` with a `defineTemplate()` default export. No registration step — auto-discovered.
- Adding a new rule = call `rule()` with `id`, `group`, `description`, `severity` (`"warn"` | `"fail"`), and `check` function returning `{ status, message? }`.
