# AGENTS.md

## Project

`@adityab-conform` — Bun + TypeScript package (ESM, `"type": "module"`).

## Commands

- **Install:** `bun install`
- **Lint & format:** `bunx biome check src/` (no config file — uses Biome defaults)
- **Typecheck:** `bunx tsc --noEmit`
- **Run:** `bun run src/index.ts`

## Toolchain

- **Runtime:** Bun (not Node). Types from `@types/bun`.
- **Linter/formatter:** Biome 2.x (no `biome.json` — defaults only). No ESLint or Prettier.
- **TypeScript:** `^7.0.1-rc` (peer dep). Strict mode with `noUncheckedIndexedAccess` and `noImplicitOverride` enabled; `noUnusedLocals`/`noUnusedParameters` disabled.
- **Module resolution:** `bundler` mode with `allowImportingTsExtensions` and `verbatimModuleSyntax`.

## Structure

- `src/index.ts` — package entrypoint (`"module": "index.ts"` in package.json)
- `docs/` — empty, placeholder
- No tests yet. No CI. No build step (`noEmit: true`).
