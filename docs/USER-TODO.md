# TODO

## Phase 1

Refactor tsconfig for STRING MATCH
Refactor biome for STRING MATCH
- .zed/settings.json
- bunfig.toml

New rule for Pulumi: No .env* / *.env files

- PACKAGE.json
  - scripts
    - check:*
    - build
  - only "#/*" as an import alias
- tsconfig.json
  - only "#/*" as an import alias
- shadcn = components.json
- vite.config.ts

Create: @tanstack-start-website @tanstack-start-webapp

GitHub Action Flow:
When a PR is created on "stable" branch or "beta" branch, Generate a Changelog using "opencode2" and Create a changeset and update CHANGELOG.md
When the PR is merged, Release, Publish and Provenance. Create a github release with changelog attached.

PR Checks: No linting errors, ensure formatting, no type errors, no conform errors

- CHANGELOG.md with changesets. Unreleased section will be contructed by Ai agents using diff directly at release. Do not maintain "unreleased" section in CHANGELOG.md.
  - [Script] Release -> pi-agent -> SKILLs -> changelog
    - writes version and changelog -> provenance and publish
- CI/cd Pipeline
  - github actions
  - RULE: "check:conform" command runs before merging to main
  - GitHub Repo Config checks
    - CODEOWNERS

---

Create: monorepo support baked into the Engine/API

- Not a Monorepo
  - no nested package.json
- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.preview

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
