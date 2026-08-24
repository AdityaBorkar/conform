# ADR 003: Deterministic and AI Rules

## Status

**Superseded / Rejected** — 2026-08-24. Never implemented. Content retained for historical record. See Decision below.

## Context

All rules in conform are currently deterministic — pure TypeScript logic returning `CheckResult`. A prior proposal argued some conformance checks require semantic understanding ("does the commit-msg hook enforce conventional commits?", "does the README adequately explain the project?") and therefore needed AI-powered rules via `@opencode-ai/sdk`.

## Original Decision (now superseded)

Rules come in two kinds `deterministic | ai` sharing the same `Rule` type, distinguished by a `kind` tag, authored via `rule()` / `aiRule({ prompt, files })`. AI uses `@opencode-ai/sdk` with `json_schema` output to produce `AiCheckResult { confidence, reasoning }`, configurable via `ConformConfig.ai { model, apiKey/apiKeyEnvVar }`, with `--disable-ai` to skip AI rules entirely and a `✱` TUI indicator.

### Original Rationale (archived)

- Tag over discriminated union for minimal refactoring.
- Built-in AI over plugin to avoid loading complexity.
- SDK over raw HTTP for type safety and structured output.
- Skip on `--disable-ai` over marking skipped to keep output clean.
- No caching to avoid invalidation complexity.

### Original Domain Model (archived)

```
Rule { id, group, description, severity, kind, check, prompt?, files? }
AiCheckResult extends CheckResult { confidence: 0-1, reasoning }
RuleResult { …, kind, confidence?, reasoning? }
ConformConfig { template, ai?: { model, apiKey?, apiKeyEnvVar? } }
```

## Current Decision

**Cut AI entirely.** No `kind`, `aiRule`, `prompt`/`files` on Rule, no `AiCheckResult`, no `ConformanceConfig.ai`, no `--disable-ai`, no `✱` or `ai` summary count, no `@opencode-ai/sdk` dependency.

Rationale:
- Zero implementation exists in `src/` (no `aiRule`, no SDK import, `src/types.ts` has no `kind`/`confidence`, reporters have no `✱`).
- Product is deterministic, check-only, CI-friendly. AI introduces non-determinism, cost, latency, secrets management, server lifecycle.
- Glossary, CONTEXT, CLI, reporters, and rule authoring all contradict the AI proposal — maintaining it keeps docs fictional.
- If semantic checks are needed in future, revisit via a new ADR (likely plugin-based, not built-in, with explicit caching and eval strategy).

## Consequences

- `CONTEXT.md`, `glossary.md`, `src/types.ts`, `src/api/*`, reporters, and CLI remain deterministic only.
- `@opencode-ai/sdk` is not a dependency.
- JSON/TUI output remains `pass/warn/fail` with `description/message`, `domain/files`, no AI fields.

## Alternatives Considered (original)

- Discriminated union `DeterministicRule | AiRule` — more type-safe, more refactoring.
- Same Rule with AI hidden inside `check()` — cannot surface `kind/confidence/reasoning`.
- Plugin architecture for AI — deferred until third-party rule kinds are needed.
- Cache AI results — rejected as premature.

## Superseded By

ADR 004 — Plugin Architecture with Oxc-Style Overrides (current deterministic model).
