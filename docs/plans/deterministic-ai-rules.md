# Implementation Plan: Deterministic & AI Rules

## Summary

Add support for two rule kinds — **deterministic** (current behavior, pure logic) and **ai** (powered by `@opencode-ai/sdk`). Rules share the same `Rule` type, differentiated by a `kind` tag. Template authors use `rule()` for deterministic and `aiRule()` for AI-powered rules. The engine routes execution based on `kind`, and output includes AI-specific fields (`confidence`, `reasoning`).

## Dependencies

- Add `@opencode-ai/sdk` as a runtime dependency
- The SDK starts an OpenCode server automatically via `createOpencode()`

## Files to Change

### 1. `src/types.ts` — Add new types

- Add `kind: "deterministic" | "ai"` to `Rule` (default `"deterministic"` for backward compat)
- Add optional `prompt?: string` and `files?: string[]` to `Rule`
- Add `AiCheckResult` interface extending `CheckResult` with `confidence: number` and `reasoning: string`
- Add `kind`, `confidence?`, and `reasoning?` to `RuleResult`
- Add `ai?: { model: string; apiKey?: string; apiKeyEnvVar?: string }` to `ConformConfig`
- Add `ai?: number` to `ConformOutput.summary`

### 2. `src/conform-api/index.ts` — Add `aiRule()` builder

- Keep `rule()` as-is (sets `kind: "deterministic"` internally)
- Add `aiRule()` builder that accepts `{ id, group, description, severity, prompt, files }` and returns a `Rule` with `kind: "ai"`
- The `aiRule()` builder does NOT accept a `check` function — the engine provides the check implementation for AI rules
- Export `aiRule` from this module

### 3. `src/index.ts` — Export new builder and types

- Add `aiRule` to the named exports
- Add `AiCheckResult` to the type exports

### 4. `src/engine/index.ts` — Route execution by `kind`

This is the core change. The engine must:

1. Accept `ConformConfig` (or just the `ai` config section) alongside the template and context
2. Accept `disableAi` boolean
3. Filter out AI rules when `disableAi` is true (skip entirely, no results)
4. For deterministic rules: call `rule.check(ctx)` as before
5. For AI rules: call a new `runAiCheck()` function

### 5. `src/engine/ai.ts` — New file: AI check execution

Create a new module that:

1. Reads files specified by `rule.files` via `ctx.readFile()`
2. Resolves API key: `config.ai.apiKey` → `process.env[config.ai.apiKeyEnvVar]` → `process.env.CONFORM_AI_API_KEY`
3. Creates an OpenCode client via `createOpencode({ config: { model: config.ai.model } })`
4. Creates a session via `client.session.create()`
5. Sends the prompt + file contents via `client.session.prompt()` with `json_schema` output format matching `AiCheckResult`
6. Parses the structured output into `AiCheckResult`
7. Disposes the client on completion

The prompt sent to the AI should be structured as:
```
You are a conformance checker. Evaluate the following files against this rule:

Rule: {rule.description}
Prompt: {rule.prompt}

Files:
--- {filePath} ---
{fileContents}
---

Respond with a JSON object: { status: "pass" | "warn" | "fail", message?: string, confidence: number (0-1), reasoning: string }
```

### 6. `src/config/load.ts` — Load AI config

- Already loads `ConformConfig` — no structural change needed
- The `ai` field is optional, so existing configs work without modification

### 7. `src/cli.ts` — Add `--disable-ai` flag

- Add `.option("--disable-ai", "Skip AI-powered rules")` to the check command

### 8. `src/commands/check.ts` — Wire new pieces together

- Pass `disableAi` from CLI options to engine
- Pass `config.ai` to engine for AI rule execution
- Handle the case where AI rules exist but no AI config is provided (error with clear message)

### 9. `src/reporter/tui.ts` — Show AI indicator

- For AI rule results, append `✱` after the status icon
- Add `(N AI)` to the summary line if any AI rules were evaluated
- Add `✱ = AI-evaluated rule` legend at the bottom when AI results exist

### 10. `src/reporter/json.ts` — Include AI fields in output

- Include `kind`, `confidence`, `reasoning` on each `RuleResult` in the JSON output
- Add `ai` count to summary

## Implementation Order

| Step | File(s) | Description |
|------|---------|-------------|
| 1 | `src/types.ts` | Add new types and fields |
| 2 | `src/conform-api/index.ts` | Add `aiRule()` builder |
| 3 | `src/index.ts` | Export new builder and types |
| 4 | `src/engine/ai.ts` | Create AI check execution module |
| 5 | `src/engine/index.ts` | Route by `kind`, integrate `ai.ts` |
| 6 | `src/cli.ts` | Add `--disable-ai` flag |
| 7 | `src/commands/check.ts` | Wire everything together |
| 8 | `src/reporter/tui.ts` | AI indicator in TUI output |
| 9 | `src/reporter/json.ts` | AI fields in JSON output |
| 10 | `package.json` | Add `@opencode-ai/sdk` dependency |
| 11 | `templates/npm-pkg/index.ts` | Add example AI rules |
| 12 | `docs/CONTEXT.md` | Already updated |
| 13 | `docs/adr/003-*.md` | Already written |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| AI rule exists, no `ai` config | Error: "Rule '{id}' requires AI config. Add `ai` section to conform.config.ts." |
| AI rule exists, no API key | Error: "No API key found. Set CONFORM_AI_API_KEY or add `apiKey`/`apiKeyEnvVar` to config." |
| AI rule exists, `--disable-ai` set | Skip rule entirely — no result, no error |
| OpenCode server fails to start | Error with SDK's error message |
| AI returns unparseable response | Fail the rule with message "AI returned unparseable result" |

## Backward Compatibility

- Existing `rule()` calls produce `Rule` objects with `kind: "deterministic"` — all existing code works
- `kind` field on `RuleResult` defaults to `"deterministic"` when not present
- `ConformConfig.ai` is optional — existing configs work unchanged
- `--disable-ai` defaults to false
- `summary.ai` is optional in JSON output

## Example: AI Rule in a Template

```ts
import { defineTemplate, rule, aiRule } from "@/conform-api/index.ts";

export default defineTemplate({
  name: "npm-publish",
  description: "Conformance rules for publishing an NPM package",
  rules: [
    // Existing deterministic rule — no changes
    rule({
      id: "package-json:name",
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

    // New AI rule
    aiRule({
      id: "husky:conventional-commits",
      group: "husky",
      description: "commit-msg hook enforces conventional commits",
      severity: "fail",
      files: [".husky/commit-msg"],
      prompt:
        "Does this commit-msg hook enforce conventional commits format (type(scope)!: description)? Check if it uses commitlint, commitzen, or a similar validation tool.",
    }),

    // Another AI rule — multiple files
    aiRule({
      id: "github-actions:labeled-releases",
      group: "github-actions",
      description: "CI/CD pipeline correctly implements labeled releases",
      severity: "fail",
      files: [
        ".github/workflows/release.yml",
        ".github/workflows/ci.yml",
        ".github/labels.yml",
      ],
      prompt:
        "Does this GitHub Actions setup correctly implement labeled releases? Check that: 1) A release workflow triggers on label events, 2) Different labels (major/minor/patch) produce correct version bumps, 3) The CI workflow runs before release.",
    }),
  ],
});
```
