# TODO

## Phase 1

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
  - only "#/*" as an import alias
- tsconfig.json
  - only "#/*" as an import alias
- .zed/settings.json
- bunfig.toml
- gitignores
  - .env*
  - *.gen.ts
- shadcn = components.json
- vite.config.ts

Create: @tanstack-start-website @tanstack-start-webapp

---

Create: monorepo support baked into the Engine/API

- Not a Monorepo
  - no nested package.json
- CHANGELOG.md with changesets
  - Unreleased section will be contructed by Ai agents using diff directly at release. Do not maintain "unreleased" section in CHANGELOG.md.
  - [Script] Release -> pi-agent -> SKILLs -> changelog
    - writes version and changelog -> provenance and publish
- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.preview
- CI/cd Pipeline
  - github actions
- GitHub Repo Config checks
  - CODEOWNERS

## Phase 2

- RULE: "check:conform" command runs before version release / deployment
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
