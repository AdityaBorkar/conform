# Rule catalog (`package` preset: 9 plugins, 62 rules)

Severity shows the default verdict. Every rule accepts `"off" | "warn" | "error"` or a flat `{ level?, ...params }` object.

## `package-json` (inspects `package.json`)

| Rule | Params | Default |
|---|---|---|
| `structure` | — | fail / warn |
| `entry-point` | `fields` = main, module, exports | fail |
| `build-script` | `scripts` = prepare, build | fail |
| `files-or-npmignore` | `file_expressions` | warn |
| `no-install-hooks` | `scripts` | fail |
| `required-fields` | `fields` | fail |
| `typecheck` | `scripts` | warn |
| `no-prepublish` | `scripts` | fail |

```ts
rules: {
  "package-json/entry-point": { fields: ["exports"] },
  "package-json/no-install-hooks": "off",
}
```

## `biome` (Style & Validation)

| Rule | Check |
|---|---|
| `dev-deps` | Biome in devDependencies (fail) |
| `config-exists` | biome.json or biome.jsonc present (fail) |
| `config` | Config matches expected (`config` param shallow-merges; missing file passes, deferred to `config-exists`) |
| `lint-script` | A lint script runs Biome (fail) |
| `format-script` | A format script runs Biome (warn) |

## `typescript` (Code Quality)

| Rule | Check |
|---|---|
| `deps` | TypeScript in dependencies (fail) |
| `tsconfig` | tsconfig.json present (fail) |
| `compiler-options` | Options match the expected strict set (`compilerOptions` param shallow-merges) |

## `husky` (Dev Environment)

| Rule | Check |
|---|---|
| `dev-deps` | Husky in devDependencies (fail) |
| `hooks-dir` | `.husky/` directory present (fail) |
| `prepare-script` | Prepare script calls Husky (fail) |
| `hook` | Each `hooks: [{ file, contains }]` entry exists and matches (fail) |

```ts
rules: { "husky/hook": { hooks: [{ file: ".husky/pre-commit", contains: "bun run format" }] } }
```

## `docs`

| Rule | Check |
|---|---|
| `readme` | README.md present and non-empty (fail) |
| `changelog` | CHANGELOG present (warn) |
| `contributing` | CONTRIBUTING present (warn) |
| `license` | LICENSE present (fail) |
| `security-md` | SECURITY.md present (warn) |

## `gitignore` (Dev Environment)

| Rule | Check |
|---|---|
| `exists` | .gitignore present (fail) |
| `excludes` | .gitignore contains every `file_expressions` entry (fail; missing file passes, deferred to `exists`) |

## `github`

File-based rules work without a token; API-backed rules require `CONFORM_GITHUB_API_TOKEN`.

| Rule | Check |
|---|---|
| `ci-workflow` | CI workflow file present (fail) |
| `release-workflow` | Release workflow present (warn) |
| `ci-lint` | CI runs lint (warn) |
| `ci-typecheck` | CI runs typecheck (warn) |
| `dependabot` | Dependabot or Renovate configured (warn) |
| `codeowners` | CODEOWNERS present and valid |
| `pr-checks` | Default-branch commit has green checks |
| `releases-immutable` | Immutable releases enabled |
| `default-branch` | Default branch correct |
| `social-preview` | Social preview image set |
| `core-features` | Issues on; wiki, discussions, projects off |
| `issue-and-pr-templates` | Issue and PR templates present |
| `merge-commit-strategy` | Merge commits allowed with PR title and description |
| `squash-merge-strategy` | Squash merging allowed with PR title and description |
| `rebase-merge-disabled` | Rebase merging disabled |
| `auto-merge-enabled` | Auto-merge enabled |
| `delete-head-branches` | Head branches deleted after merge |
| `web-signoff-not-required` | Web sign-off not required |
| `environments` | Required deployment environments exist |
| `manual-settings` | UI-only settings (verify by hand in GitHub settings) |
| `actions-policy` | Actions enabled for all actions and reusable workflows |
| `actions-sha-pinning` | Actions pinned to full-length commit SHA |
| `actions-retention` | Artifact and log retention ≥ 90 days |
| `actions-fork-approval` | Approval required for external contributors |
| `actions-workflow-permissions` | Workflow token read-only, cannot approve PRs |
| `private-vulnerability-reporting` | Private reporting enabled (Security & Governance) |
| `dependency-graph` | Dependency graph enabled (Security & Governance) |
| `dependabot-alerts` | Dependabot alerts enabled (Security & Governance) |
| `secret-protection` | Secret scanning enabled (Security & Governance) |
| `push-protection` | Push protection enabled (Security & Governance) |

## `zed` (Dev Environment)

| Rule | Check |
|---|---|
| `dir` | `.zed/` present (fail) |
| `settings-exists` | `.zed/settings.json` present (fail) |
| `settings` | Settings match expected (params shallow-merge; extra keys fail) |

## `bun` (Build & Tasks)

| Rule | Check |
|---|---|
| `bunfig-exists` | bunfig.toml present (fail) |
| `bunfig-content` | bunfig.toml matches expected (telemetry off, logLevel warn, ignore-scripts true; missing file passes) |

Param defaults live in `src/plugins/*.ts` next to each `EXPECTED_*` constant. The preset pre-tunes `biome/config`, `bun/bunfig-content`, `gitignore/excludes`, `husky/hook`, `package-json/required-fields`, `typescript/compiler-options`, and `zed/settings`.
