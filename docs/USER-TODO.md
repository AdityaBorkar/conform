- Check for /docs/CONTEXT.md /plans /adr glossary.md USER-TODO.md

- husky with conventional-commits
- CHANGELOG.md with changesets
- changeset and CI/cd Pipeline
- github actions
- 
- Not a Monorepo
  - no nested package.json or tsconfig.json or biome.json
- 
- package.json check:* build
- 
- ensure .npmrc with "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
- 
- No "#!/usr/bin/env bun" in any file header
- 
- tests/setup/. e2e/ integration/
- 
- PACKAGE.json
  - author and contributors information
- gitignores
  - .gen.ts is always git ignored
  - .env*
  - !.env.example
  - *.gen.ts
- bunfig.toml
- Infra
  - No docker.compose files
  - package.json infra:*
  - Pulumi.dev and Pulumi.production and Pulumi.staging

---

- GitHub Repo Config checks
- CODEOWNERS

---

- package.json check:* build infra:*
- components.json
- vite.config.ts
- Breaking down of rules and composing templates out of them

---

- Manual Research:
  - JSR Scoring Factors
  - NPM Package
-
