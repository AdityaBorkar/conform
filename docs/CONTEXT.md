# CONTEXT.md — @adityab/conform

## What It Is

`@adityab/conform` is a CLI tool that checks whether a repository conforms to a predefined template. It detects drift between a repo's actual state and the expected state defined by a template, and reports that drift in the terminal.

## Core Problem

Teams scaffold repos from templates but drift accumulates over time — missing hooks, dropped config fields, absent CI files. There is no automated way to verify conformance. Conform fills this gap.

## Design Principles

1. **Templates are code** — TypeScript modules, not data files. Rules can inspect anything.
2. **Check-only, no auto-fix** — Report drift. Let humans fix it. Simpler, safer, CI-friendly.
3. **Templates are opinionated** — No per-repo overrides. If a template says `license` is a fail, it's a fail. Don't like it? Write a different template.
4. **Atomic rules, grouped display** — Each check is atomic and independently testable. The TUI groups them for readability.
5. **Zero config from CLI** — Template selection lives in `conform.config.ts`. No `--template` flag. The config file IS the interface.

## Domain Model

```
Template
  name: string
  description: string
  rules: Rule[]

Rule
  id: string              — e.g. "package-json:name-field"
  group: string           — e.g. "package.json"
  description: string     — Human-readable explanation
  severity: Fail | Warn   — Expected severity if the check doesn't pass
  kind: "deterministic" | "ai"
  check: (ctx) => CheckResult | Promise<CheckResult>   — deterministic rules
  prompt?: string         — ai only: instruction to the AI
  files?: string[]        — ai only: which files to feed to the AI

CheckResult
  status: Pass | Warn | Fail
  message?: string        — Why it passed/failed

AiCheckResult extends CheckResult
  confidence: number      — 0-1, how confident the AI is
  reasoning: string       — Why the AI reached this conclusion

CheckContext
  targetPath: string
  readFile(relPath): string | null
  readJson(relPath): JsonValue | null
  fileExists(relPath): boolean
  packageJson: PackageJson | null

RuleResult
  id: string
  group: string
  description: string
  severity: RuleSeverity
  status: Severity
  message?: string
  kind: "deterministic" | "ai"
  confidence?: number     — ai only
  reasoning?: string      — ai only

ConformConfig
  template: string
  ai?: {
    model: string                              — e.g. "anthropic/claude-sonnet-4-5-20250929"
    apiKey?: string                            — inline key (not recommended for committed configs)
    apiKeyEnvVar?: string                      — env var name, default "CONFORM_AI_API_KEY"
  }

Severity = Pass | Warn | Fail
```

## Template Structure

Templates live in `./templates/` at the package root. Each template is a directory containing an `index.ts` that exports a `Template`:

```
templates/
  npm-publish/
    index.ts
```

A template file looks like:

```ts
import { defineTemplate, rule, aiRule } from "@adityab/conform";

export default defineTemplate({
  name: "npm-publish",
  description: "Conformance rules for publishing an NPM package",
  rules: [
    rule({
      id: "package-json:name-field",
      group: "package.json",
      description: "name field is present in package.json",
      severity: "fail",
      check: (ctx) => {
        if (!ctx.packageJson?.name) {
          return { status: "fail", message: "name field is missing" };
        }
        return { status: "pass", message: ctx.packageJson.name };
      },
    }),
    aiRule({
      id: "husky:conventional-commits",
      group: "husky",
      description: "commit-msg hook enforces conventional commits",
      severity: "fail",
      files: [".husky/commit-msg"],
      prompt:
        "Does this commit-msg hook enforce conventional commits format (type(scope)!: description)? Check if it uses commitlint or a similar tool.",
    }),
  ],
});
```

## Config File

Target repos declare which template they conform to via `conform.config.ts`:

```ts
import { defineConfig } from "@adityab/conform";

export default defineConfig({
  template: "npm-publish",
  ai: {
    model: "anthropic/claude-sonnet-4-5-20250929",
    // Option 1: env var (recommended) — reads CONFORM_AI_API_KEY by default
    // Option 2: inline key (not recommended for committed configs)
    // apiKey: "sk-...",
  },
});
```

## CLI

```
conform check [--path <dir>] [--json] [--disable-ai]
```

- `check` — Run conformance checks against the configured template
- `--path` — Target directory (default: CWD)
- `--json` — Machine-readable JSON output instead of TUI table
- `--disable-ai` — Skip all AI-powered rules (they are excluded from results entirely)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All rules pass |
| 1 | One or more failures (takes priority over warnings) |
| 2 | Warnings only, no failures |

## TUI Output

```
@adityab/conform — npm-publish template

package.json
  ✓ name-field          @adityab/conform
  ✓ version-field       1.0.0
  ✗ license-field       license field is missing
  ⚠ description-field   description field is missing

husky
  ✓ dev-deps            husky in devDependencies
  ✗ hooks-dir           .husky/ directory missing
  ✗ conventional-commits ✱ commit-msg hook does not enforce conventional commits

biome
  ✓ dev-deps            @biomejs/biome in devDependencies
  ⚠ config-file         biome.json not found

typescript
  ✓ deps                typescript in peerDependencies
  ✓ tsconfig            tsconfig.json exists
  ✓ strict-mode         strict: true in tsconfig

files
  ✗ license             LICENSE file missing
  ⚠ readme              README.md is empty
  ✓ gitignore           .gitignore exists

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  12 passed  ·  3 warned  ·  5 failed   (1 AI)
```

✱ = AI-evaluated rule

## JSON Output

```json
{
  "template": "npm-publish",
  "path": "/path/to/repo",
  "results": [
    {
      "id": "package-json:name-field",
      "group": "package.json",
      "description": "name field is present in package.json",
      "status": "pass",
      "message": "@adityab/conform",
      "kind": "deterministic"
    },
    {
      "id": "husky:conventional-commits",
      "group": "husky",
      "description": "commit-msg hook enforces conventional commits",
      "status": "fail",
      "message": "commit-msg hook does not enforce conventional commits",
      "kind": "ai",
      "confidence": 0.87,
      "reasoning": "The .husky/commit-msg file contains only an echo statement with no commitlint or similar validation tool configured."
    }
  ],
  "summary": { "pass": 12, "warn": 3, "fail": 5, "ai": 1 }
}
```

## NPM Package Publishing Template — Rule Set

| Group | Rule ID | Description | Severity |
|-------|---------|-------------|----------|
| package.json | `package-json:name` | `name` field present | fail |
| package.json | `package-json:version` | `version` field present | fail |
| package.json | `package-json:description` | `description` field present | warn |
| package.json | `package-json:license` | `license` field present | fail |
| package.json | `package-json:entry-point` | `main`/`module`/`exports` entry defined | fail |
| package.json | `package-json:files-or-npmignore` | `files` field or `.npmignore` exists | warn |
| package.json | `package-json:repository` | `repository` field present | warn |
| package.json | `package-json:type-module` | `type` is `"module"` | fail |
| package.json | `package-json:build-script` | `scripts.prepare` or `scripts.build` exists | fail |
| husky | `husky:dev-deps` | `husky` in devDependencies | fail |
| husky | `husky:hooks-dir` | `.husky/` directory exists | fail |
| husky | `husky:prepare-script` | `prepare` script calls `husky` | fail |
| husky | `husky:pre-commit-hook` | pre-commit hook exists | warn |
| husky | `husky:commit-msg-hook` | commit-msg hook exists | warn |
| biome | `biome:dev-deps` | `@biomejs/biome` in devDependencies | fail |
| biome | `biome:config-file` | `biome.json` or `biome.jsonc` exists | warn |
| biome | `biome:lint-script` | lint command in scripts | fail |
| typescript | `typescript:deps` | `typescript` in devDeps or peerDeps | fail |
| typescript | `typescript:tsconfig` | `tsconfig.json` exists | fail |
| typescript | `typescript:strict` | `strict: true` in tsconfig | fail |
| files | `files:license` | `LICENSE` file exists | fail |
| files | `files:readme` | `README.md` exists | warn |
| files | `files:gitignore` | `.gitignore` exists | fail |
