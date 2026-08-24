# ADR 001: Code-Based presets

## Status

Accepted

## Context

presets define the rules that a repository must conform to. We need to decide whether presets are declarative data files (YAML/JSON) interpreted by an engine, or code-based TypeScript modules that directly implement checks.

## Decision

presets are code-based TypeScript modules.

## Rationale

- **Expressiveness** — Some checks require arbitrary logic (e.g., "does the prepare script call husky?" requires string matching, not just field existence). A declarative schema would need increasingly complex primitives to cover these cases, converging on a DSL that's worse than just writing TypeScript.
- **Type safety** — Rules are TypeScript functions with typed contexts and results. Catch errors at authoring time, not runtime.
- **No DSL maintenance** — A declarative format requires designing, documenting, versioning, and maintaining a schema language. Code-based presets reuse TypeScript itself.
- **Familiarity** — The target audience is TypeScript developers. Writing a rule function is more natural than learning a custom schema syntax.

## Consequences

- presets cannot be inspected/parsed without executing TypeScript. No static analysis of preset contents.
- preset authors can introduce side effects or non-deterministic behavior in check functions. We mitigate this by keeping the plugin context read-only (`src/utils/fs.ts` only).
- preset versioning is just package versioning — no separate schema version needed.

## Amendment 2026-08-24

- Canonical locations are `src/presets/*.ts` (presets) composing `src/plugins/*.ts` (plugins) — not `presets/` at repo root as originally written. `src/api/resolver.ts` still looks in `presets/` (known gotcha; should be `src/presets/`). See CONTEXT.md and ADR 004.

## Alternatives Considered

- **Declarative YAML/JSON** — Simpler to parse and inspect, but requires building a DSL for anything beyond "file exists" and "JSON field equals X". Would need escape hatches for complex checks, negating the simplicity benefit.
- **Hybrid (declarative + code escape hatches)** — Adds complexity without sufficient benefit. The escape hatch becomes the common path, and the declarative layer becomes ceremony.
