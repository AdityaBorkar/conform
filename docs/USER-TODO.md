# TODO

## Phase 1

- Not a Monorepo
  - no nested package.json

Refactor tsconfig for STRING MATCH
Refactor biome for STRING MATCH
- .zed/settings.json
- bunfig.toml
- PACKAGE.json
  - scripts
    - check:*
    - build
  - only "#/*" as an import alias
- tsconfig.json
  - only "#/*" as an import alias
- Create: @tanstack-start-website @tanstack-start-webapp
- shadcn = components.json
- vite.config.ts

- GitHub Repo Config checks
  - PR Checks: No linting errors, ensure formatting, no type errors, no conform errors
  - CODEOWNERS

- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.preview
  - New rule for Pulumi: No .env* / *.env files

## Phase 2

- Output of the Tool must be optimized for AI agents
- Ensure rules are first-principles like rules that can be easily extended and composed together in the preset.
  - SKILL: /write-rule
  - SKILL: /write-preset
- Create a wiki for ai agents to navigate this repo
- Create a plan-of-action for docs under @adistack/*
- Plugin Extensions:
  - JSR Scoring Factors
  - NPM Package
  - Testing Config
    - vitest
    - tests/setup/. e2e/ integration/
