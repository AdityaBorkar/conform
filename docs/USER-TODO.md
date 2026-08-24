# TODO

## Phase 1

improve-codebase-architecture
deslop

- husky with conventional-commits
- CHANGELOG.md with changesets
- CI/cd Pipeline
  - github actions
- GitHub Repo Config checks
  - CODEOWNERS
- Not a Monorepo
  - no nested package.json or tsconfig.json or biome.json
- PACKAGE.json
  - check:* build
  - author and contributors information
- Testing Config
  - vitest
  - tests/setup/. e2e/ integration/
- gitignores
  - .gen.ts is always git ignored
  - .env*
  - *.gen.ts
- bunfig.toml
- .zed/settings.json
- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.preview
- components.json
- vite.config.ts
- Breaking down of rules and composing templates out of them

## Phase 2

- Create a plan-of-action for docs under @adistack/*
- Create a skill to use this repo and a wiki for ai agents to navigate this repo
- Manual Research:
  - JSR Scoring Factors
  - NPM Package
