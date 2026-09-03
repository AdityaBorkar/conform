# Contributing

## Setup

```sh
bun install
```

Bun only (`engines: bun >= 1.0.0`). `bunfig.toml` sets `ignore-scripts=true` and `minimumReleaseAge=259200`.

## Verify

Required order (mirrors CI `check.yml` on `stable`/`beta`):

```sh
bun run check:types     # tsc --noEmit
bun run check:lint:ci   # biome check . (no fix — CI mode)
bun run check:conform   # bun src/cli/index.ts check (dogfoods preset: "package")
```

Fix/format helpers:

```sh
bun run check:lint   # biome check . --fix
bun run format       # biome format --write .
bun run lint         # biome check . (alias, no fix)
```

## Tests

```sh
bun run test              # vitest run (all of tests/**/*.test.ts)
bun run test:unit         # excludes tests/e2e/**
bun run test:e2e          # tests/e2e/ (spawns the CLI: pass-case + no-config exit 2)
bun run test:integration  # tests/integration/ --passWithNoTests (dir is empty)
bun run test:watch        # vitest watch mode
```

Single test:

```sh
bunx vitest run tests/e2e/check.test.ts -t "<name>"
```

## Run the CLI locally

```sh
bun run src/cli/index.ts check [--path <dir>] [--json] [-v] [--group domains|files]
```

`bin: conform → src/cli/index.ts`, so `bunx conform check` is equivalent once linked.

## Code standards

- Read [`CONTEXT.md`](./CONTEXT.md) (canonical terms), [`docs/architecture.md`](./docs/architecture.md) (engine, authoring, output), and [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) (toolchain, TS strict, Biome, testing).
- Public surface only: `src/index.ts` (+ `./plugins → src/plugins/index.ts`). No deep imports from outside `src/`; cross-module imports use the `#/* → ./src/*` alias.
- Rules belong to Plugins (`definePlugin` + `plugin.defineRule`); rule params use arktype `type()`. Presets live in `src/presets/*.ts` (curried `definePreset([plugins] as const)({…})` preferred).
- Biome 2.x: 2-space, double-quotes, LF, width 80. TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `allowImportingTsExtensions`).

## Commits

Husky hooks: `pre-commit` runs `bun run format`; `commit-msg` runs `bun commitlint --edit "$1"`.

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <description>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `wip`.

## Changesets & dependencies

```sh
bun run changeset   # add a changeset
bun run version     # apply versions from changesets
bun run release     # publish (changesets/action on stable/beta/main)
bun run update:deps # taze -w && bun install
```

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes (add a changeset via `bun run changeset` for user-facing changes)
4. Ensure `bun run check:types`, `bun run check:lint:ci`, and `bun run check:conform` pass
5. Ensure `bun run test` passes
6. Open a pull request (CI `check.yml` gates `stable`/`beta`; `release.yml` reuses it before publishing)
