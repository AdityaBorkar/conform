---
name: write-adistack-docs
description: Write or repair docs in www/ for @adistack/conform. Use when the user mentions docs, www, fumadocs, mdx, meta.json, presets page, plugins page, or agent-friendly documentation.
---

# Write Adistack Docs

docs in `www/` are the fumadocs remote source. Code in `src/` stays the single source of truth; docs trace to it, never duplicate it.

## Orient

1. Read `/CONTEXT.md` for canonical terms (Preset, Plugin, Rule, Target, drift).
2. Read `www/meta.json` plus the target `.mdx` pages.
3. Read the source the docs describe (`src/presets/*.ts`, `src/plugins/*.ts`, `src/api/engine.ts`, `src/cli/check.ts`).

Done when you can name the affected `www/` pages and the `src/` files that prove each claim.

## Branch A: write or fix a page

1. Load `references/house-style.md` and `references/fumadocs.md`, then follow both.
2. Write the change into `www/*.mdx` (and `www/meta.json` only when adding, removing, or reordering a page).
3. Trace every rule ID, count, default, exit code, and snippet to its source.

Done when every heading, snippet, and table row on the touched pages traces to `src/` or to a verified command run.

## Branch B: audit docs drift

1. Load `references/house-style.md` and `references/fumadocs.md`, then apply the verification checklist in `house-style.md`.
2. Enumerate every `plugin-id/rule-id`, rule count, severity default, flag, exit code, and import path in `www/` and check each against `src/`.
3. Fix drift in place under Branch A.

Done when every rule ID resolves, every count matches `src/`, and every snippet has been executed.

## Verify

1. Re-read each touched `.mdx` fully.
2. Run `bunx conform check` from the repo root when the change documents behavior.
3. Confirm `www/meta.json` parses and frontmatter on touched pages matches `references/fumadocs.md`.

Done when all touched pages read clean, `meta.json` parses, and the conform run passes or its drift is explicitly owned.

## Compact reference

| Term | docs usage |
|---|---|
| Preset | Capitalized; `package` in backticks; lives in `src/presets/*.ts` |
| Plugin | Group inside a preset; rule IDs always namespaced `plugin-id/rule-id` |
| Rule | One atomic check; one job per rule, one job per page section |
| Target | File view rules read through (`fileExists`, `readFile`, `readJson`, `packageJson`) |
| Drift | Any `warn` or `fail`; docs say fix first, mute last |

- docs target is `www/` (fumadocs source). `docs/architecture.md` is internal and never the output.
- Bun is required; Node is unsupported. Preset selection lives in `conform.config.ts`; there is no `--preset` flag.
- Many `github/*` rules require `CONFORM_GITHUB_API_TOKEN`; docs note the token or the `off` escape hatch.
