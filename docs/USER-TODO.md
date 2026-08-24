# TODO

## Phase 1

Ensure rules are first-principles like rules that can be easily extended and composed together in the preset.
SKILL: /write-rule
SKILL: /write-preset

/init
improve-codebase-architecture

Refactor gitignore docs files
Refactor tsconfig for STRING MATCH
Refactor biome for STRING MATCH

New rule for Pulumi: No .env* / *.env files
Generated files are git ignored "*.gen.ts"

- PACKAGE.json
  - scripts
    - check:*
    - build
  - package:
    - publishConfig
    - homepage
    - files
    - bugs
    - description
    - keywords
    - engines
- .zed/settings.json
- bunfig.toml
- gitignores
  - .env*
  - *.gen.ts
- Not a Monorepo
  - no nested package.json
- components.json
- vite.config.ts
- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.preview

Create: monorepo support baked into the Engine/API

Create: @tanstack-start-website @tanstack-start-webapp

/init
improve-codebase-architecture
deslop

- CHANGELOG.md with changesets
- CI/cd Pipeline
  - github actions
- GitHub Repo Config checks
  - CODEOWNERS

## Phase 2

- Output of the Tool must be optimized for AI agents
- Create a skill to use this repo and a wiki for ai agents to navigate this repo
- Create a plan-of-action for docs under @adistack/*
- Plugin Extensions:
  - JSR Scoring Factors
  - NPM Package
  - Testing Config
    - vitest
    - tests/setup/. e2e/ integration/
