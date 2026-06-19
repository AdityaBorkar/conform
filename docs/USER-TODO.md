--group flag is not supported for --reporter=json

- Check for /docs/CONTEXT.md /plans /adr glossary.md USER-TODO.md
- husky with conventional-commits
- CHANGELOG.md with changesets
- changeset and CI/cd Pipeline
- github actions
- package.json check:* build
- ensure .npmrc with "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
- no nested package.json or tsconfig.json or biome.json
- No "#!/usr/bin/env bun" in any file header
- tests/setup/. e2e/ integration/
- author and contributors information
- gitignores
  - .gen.ts is always git ignored
  - .env*
  - !.env.example
  - *.gen.ts
- bunfig.toml
- No docker.compose files

---

- GitHub Repo Checks
- GitHub Repo Config checks
- CODEOWNERS

---

- package.json check:* build infra:*
- components.json
- Pulumi.dev and Pulumi.production and Pulumi.staging
- vite.config.ts
