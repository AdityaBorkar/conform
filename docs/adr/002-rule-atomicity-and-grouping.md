# ADR 002: Atomic Rules with Grouped Display

## Status

Accepted

## Context

A preset like "husky is implemented" is really multiple distinct checks (devDependency present, directory exists, hooks configured, prepare script set up). We need to decide whether each of these is a separate rule or whether they're bundled into one rule with sub-checks.

## Decision

Rules are atomic — each rule performs exactly one check. The TUI output groups rules for readability — now by `domain` then `files` (default) or by `files` (`--group files`), not a single `group` field.

## Rationale

- **Composability** — Atomic rules can be reused across presets without pulling in unrelated checks.
- **Precise reporting** — Users see exactly which sub-check failed, not just "husky: fail" with no detail.
- **Testability** — Each rule can be unit tested independently.
- **Grouped display** — The `domain` (+ `files`) fields on each rule control TUI rendering (`renderByDomains` / `renderByFiles`), giving visual clarity without coupling checks.

## Consequences

- presets will have many rules (the `package` preset has 37 across 9 plugins). This is fine — the grouped TUI display makes this scannable.
- Rule IDs must be globally unique within a preset. Convention: `pluginId/ruleId` (e.g., `husky/dev-deps`), enforced by `Plugin` namespacing.

## Amendment 2026-08-24 (current), updated 2026-08-25

- Original `group` field is now `domain: string` (e.g. `DOMAIN.DEV_ENVIRONMENT`) plus `files: string[]`. `GroupBy = "domains" | "files"` selects `renderByDomains` vs `renderByFiles`. See ADR 004 and `src/types.ts`.
- `package` preset grew from 36 rules / 7 plugins to 37 rules / 9 plugins (`zed`, `bun` added); see `src/presets/package.ts` and `docs/architecture.md`.

## Alternatives Considered

- **Grouped rules with sub-checks** — A `Rule` contains `Assertion[]`. Simpler TUI rendering but harder to compose and test. The sub-check abstraction adds complexity without real benefit.
- **Flat rules, flat display** — No grouping. A long unstructured list is hard to scan.
