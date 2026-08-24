# TODO

## Phase 1

Ensure rules are first-principles like rules that can be easily extended and composed together in the preset.
SKILL: /write-rule
SKILL: /write-preset

Move the @scripts to @package_json

Remove the @testing @jsr @bin @slow-types @bin

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

/init
improve-codebase-architecture
deslop

- CHANGELOG.md with changesets
- CI/cd Pipeline
  - github actions
- GitHub Repo Config checks
  - CODEOWNERS
- Testing Config
  - vitest
  - tests/setup/. e2e/ integration/

## Phase 2

- Create a plan-of-action for docs under @adistack/*
- Create a skill to use this repo and a wiki for ai agents to navigate this repo
- Manual Research:
  - JSR Scoring Factors
  - NPM Package
