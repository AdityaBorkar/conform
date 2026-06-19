# ADR 001: Code-Based Templates

## Status

Accepted

## Context

Templates define the rules that a repository must conform to. We need to decide whether templates are declarative data files (YAML/JSON) interpreted by an engine, or code-based TypeScript modules that directly implement checks.

## Decision

Templates are code-based TypeScript modules.

## Rationale

- **Expressiveness** — Some checks require arbitrary logic (e.g., "does the prepare script call husky?" requires string matching, not just field existence). A declarative schema would need increasingly complex primitives to cover these cases, converging on a DSL that's worse than just writing TypeScript.
- **Type safety** — Rules are TypeScript functions with typed contexts and results. Catch errors at authoring time, not runtime.
- **No DSL maintenance** — A declarative format requires designing, documenting, versioning, and maintaining a schema language. Code-based templates reuse TypeScript itself.
- **Familiarity** — The target audience is TypeScript developers. Writing a rule function is more natural than learning a custom schema syntax.

## Consequences

- Templates cannot be inspected/parsed without executing TypeScript. No static analysis of template contents.
- Template authors can introduce side effects or non-deterministic behavior in check functions. We mitigate this by keeping the CheckContext API read-only.
- Template versioning is just package versioning — no separate schema version needed.

## Alternatives Considered

- **Declarative YAML/JSON** — Simpler to parse and inspect, but requires building a DSL for anything beyond "file exists" and "JSON field equals X". Would need escape hatches for complex checks, negating the simplicity benefit.
- **Hybrid (declarative + code escape hatches)** — Adds complexity without sufficient benefit. The escape hatch becomes the common path, and the declarative layer becomes ceremony.
