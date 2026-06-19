# ADR 002: Atomic Rules with Grouped Display

## Status

Accepted

## Context

A template like "husky is implemented" is really multiple distinct checks (devDependency present, directory exists, hooks configured, prepare script set up). We need to decide whether each of these is a separate rule or whether they're bundled into one rule with sub-checks.

## Decision

Rules are atomic — each rule performs exactly one check. The TUI output groups rules by their `group` field for readability.

## Rationale

- **Composability** — Atomic rules can be reused across templates without pulling in unrelated checks.
- **Precise reporting** — Users see exactly which sub-check failed, not just "husky: fail" with no detail.
- **Testability** — Each rule can be unit tested independently.
- **Grouped display** — The `group` field on each rule controls TUI rendering, giving the visual clarity of grouped rules without coupling the checks themselves.

## Consequences

- Templates will have many rules (the npm-publish template has 23). This is fine — the grouped TUI display makes this scannable.
- Rule IDs must be globally unique within a template. Convention: `<group-shorthand>:<specific-check>` (e.g., `husky:dev-deps`).

## Alternatives Considered

- **Grouped rules with sub-checks** — A `Rule` contains `Assertion[]`. Simpler TUI rendering but harder to compose and test. The sub-check abstraction adds complexity without real benefit.
- **Flat rules, flat display** — No grouping. A long unstructured list is hard to scan.
