# TODO

## Phase 1

- Not a Monorepo
  - no nested package.json

CLEANUP

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
- wrangler
- github-actions: workflows, dependebot, codeowners
- .commitlintrc.json

- GitHub Repo Config checks
  - PR Checks: No linting errors, ensure formatting, no type errors, no conform errors
  - CODEOWNERS
  - GENERAL:
    - Releases: Disallow assets and tags from being modified once a release is published. 
    - Default Branch: stable
    - Social preview: image
    - disable: wiki, discussions, projects
    - enable: issues, issue templates, pr
    - allow merge commits: pr title & description
    - allow squash merging: pr title & description
    - disable rebase merging
    - allow auto-merge
    - Auto-close issues with merged linked pull requests 
    - Automatically delete head branches
    - DISABLE:
      - Require contributors to sign off on web-based commits
      - Allow comments on individual commits 
      - Include Git LFS objects in archives 
      - Limit how many branches and tags can be updated in a single push
  - CODE REVIEW
    - Limit to users explicitly granted read or higher access
  - RULESETS
  - ACTIONS
    - Allow all actions and reusable workflows 
    - Require actions to be pinned to a full-length commit SHA
    - Artifact and log retention  = 90 days
    - Require approval for all external contributors
    - Workflow permissions: Read repository contents and packages permissions 
    - DISABLE: Allow GitHub Actions to create and approve pull requests
    - oidc: Use immutable subject claim
  - Planning
    - Agent suggestions for issues = Full Control
  - Environments
    - stable
    - beta
  - Advanced Security
    - Enable Private vulnerability reporting 
    - Enable Dependency graph & Enabled  Automatic dependency submission 
    - Enable Dependabot
    - Disable  Copilot Autofix 
    - Enable Secret Protection
    - Enable Push protection
  - Secrets and Variables: Actions

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
