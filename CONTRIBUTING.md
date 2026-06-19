# Contributing

## Setup

```sh
bun install
```

## Development

```sh
# Lint & format
bun run check:lint

# Typecheck
bun run check:types

# Run tests
bun test

# Run CLI locally
bun run src/cli.ts check
```

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <description>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `wip`.

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure `bun run check:lint` and `bun run check:types` pass
5. Ensure `bun test` passes
6. Open a pull request
