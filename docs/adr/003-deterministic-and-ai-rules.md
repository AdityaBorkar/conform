# ADR 003: Deterministic and AI Rules

## Status

Accepted

## Context

All rules in conform are currently deterministic — they run pure TypeScript logic against a `CheckContext` and return a `CheckResult`. Some conformance checks cannot be expressed as boolean field checks or string matching. Examples:

- "Does the GitHub Actions workflow correctly implement labeled releases?"
- "Does the Husky commit-msg hook enforce conventional commits?"
- "Does the README adequately explain the project?"

These require semantic understanding of file contents — a capability only AI can provide. We need to support both deterministic and AI-powered rules while keeping the template authoring experience consistent.

## Decision

Rules come in two kinds: **deterministic** and **ai**. They share the same `Rule` type but are distinguished by a `kind` tag. Template authors use two builder functions — `rule()` for deterministic, `aiRule()` for AI-powered — that produce the same `Rule` interface.

The AI integration uses `@opencode-ai/sdk` as a built-in dependency (not a plugin). AI rules specify a `prompt` and `files` array in their definition. The engine reads the specified files, sends them along with the prompt to the OpenCode SDK, and returns an `AiCheckResult` with confidence and reasoning.

## Rationale

- **Option C+tag over discriminated union** — Same `Rule` type means the engine, reporters, and all existing code that handles `Rule[]` continues to work. The `kind` tag lets the engine route execution and enrich output without bifurcating the type system.
- **Built-in AI over plugin** — AI rules are a core feature, not an optional extension. Making it built-in avoids the complexity of plugin loading and version coordination.
- **@opencode-ai/sdk over raw HTTP** — The SDK provides a type-safe client, structured output support, and handles server lifecycle. It supports `json_schema` output format which maps naturally to `CheckResult`.
- **Skip on --disable-ai over marking skipped** — When AI is disabled, the user explicitly opted out. Showing "skipped" results adds noise. Skipping entirely keeps output clean.
- **No caching** — AI results depend on model version, file state, and prompt. Caching adds complexity (cache invalidation, storage location, staleness) without sufficient benefit for a CLI tool that runs on demand.

## Domain Model Changes

### Before

```
Rule
  id: string
  group: string
  description: string
  severity: RuleSeverity
  check: (ctx) => CheckResult | Promise<CheckResult>

CheckResult
  status: Severity
  message?: string
```

### After

```
Rule
  id: string
  group: string
  description: string
  severity: RuleSeverity
  kind: "deterministic" | "ai"
  check: (ctx) => CheckResult | Promise<CheckResult>  // deterministic
  prompt?: string        // ai only — instruction to the AI
  files?: string[]       // ai only — which files to feed

CheckResult
  status: Severity
  message?: string

AiCheckResult extends CheckResult
  confidence: number     // 0-1
  reasoning: string      // why the AI reached this conclusion

RuleResult
  id: string
  group: string
  description: string
  severity: RuleSeverity
  status: Severity
  message?: string
  kind: "deterministic" | "ai"
  confidence?: number    // ai only
  reasoning?: string     // ai only

ConformConfig
  template: string
  ai?: {
    model: string                          // e.g. "anthropic/claude-sonnet-4-5-20250929"
    apiKey?: string                        // inline key (not recommended for committed configs)
    apiKeyEnvVar?: string                  // env var name, default "CONFORM_AI_API_KEY"
  }
```

## Consequences

- `@opencode-ai/sdk` becomes a runtime dependency. The OpenCode server must be available (the SDK starts it automatically).
- AI rules are slower and may incur costs. The `--disable-ai` CLI flag lets users opt out.
- `AiCheckResult` fields (confidence, reasoning) appear in JSON output for AI rules only. The TUI shows a subtle indicator for AI-evaluated rules.
- Template authors must install and configure the SDK. If the server fails to start or no API key is configured, AI rules fail at runtime with a clear error message.
- The `kind` field on `RuleResult` is always present, making the output self-describing.

## Alternatives Considered

- **Discriminated union (Option A)** — Separate `DeterministicRule` and `AiRule` types. More type-safe but requires updating every function that accepts `Rule[]` to handle the union. The `kind` tag achieves the same routing with less refactoring.
- **Same Rule, no tag (Option B)** — AI rules are just rules whose `check()` calls AI internally. The engine can't report `kind`, `confidence`, or `reasoning` in a structured way. Unacceptable — these fields are required in output.
- **Plugin architecture** — AI as an external plugin package. Adds indirection and version coordination for a core feature. Reconsider if/when third-party rule kinds are needed.
- **Cache AI results** — Cache keyed on file hashes + prompt. Adds storage concerns and staleness risk. Not worth it for a CLI tool.
