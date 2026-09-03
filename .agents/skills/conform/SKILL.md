---
name: conform
description: Run conform checks and fix drift, tune rule overrides in conform.config.ts, or author conform Plugins and Presets. Use when the user mentions conform, drift, conformance presets, conform.config.ts, or repo consistency checks.
---

# Conform

Conform checks a repository against a code-defined Preset and reports drift. Each run ends with passing checks, fixed drift, or an explicit decision per remaining warning or failure.

## Orient

1. Read `/CONTEXT.md` for canonical terms (Preset, Plugin, Rule, Target, drift).
2. Read `conform.config.ts` at the target root to learn the preset name and existing overrides.
3. For monorepos, read the `defineMonorepoConfig` mapping and confirm every workspace package has a key.

Done when you can name the preset and the target path.

## Branch A: check and fix drift

1. Run `bunx conform check` (add `--path <dir>` for another repo, `-v` to show passes, `--json` for machines).
2. Read each `warn` or `fail` by rule ID (`plugin-id/rule-id`).
3. Fix the repository to satisfy the rule. Soften with an override only when the rule genuinely does not apply.
4. Re-run until green.

Exit codes: `0` means all pass; `1` means any fail, or `--json` combined with `--group`; `2` means warnings only, missing config, or unknown preset. Failure outranks warning.

Done when the check exits 0, or every remaining warning or failure has an explicit owner decision.

## Branch B: tune overrides

String form sets severity only; object form sets params with optional severity. Both are flat, with no `params` wrapper:

```ts
rules: {
  "biome/format-script": "warn",
  "github/dependabot": "off",
  "gitignore/excludes": { file_expressions: ["node_modules", ".env*"] },
  "husky/hook": { level: "error", hooks: [{ file: ".husky/pre-commit", contains: "bun run format" }] },
}
```

Severity behavior: `off` skips the rule; `warn` demotes failures; `error` promotes warnings to failures; passes never change. Unknown levels and invalid params fail closed with `Invalid severity` or `Invalid params`.

Done when the check re-runs with no `Invalid severity` or `Invalid params` errors.

## Branch C: author a Plugin or Preset

Load `references/authoring.md` for the full authoring guide, then follow it.

Done when the new rule runs under its `plugin-id/rule-id` and the preset resolves by name.

## Verify

Re-run `bunx conform check` after every change. If you touched `src/`, also run `bun run check:types`, then `bun run check:lint:ci`.

## Compact reference

| Term | Meaning |
|---|---|
| Preset | Named check collection in `src/presets/*.ts` (today: `package`, 9 plugins, 62 rules) |
| Plugin | Related rule group (`biome`, `husky`, …); rule IDs are namespaced `plugin-id/rule-id` |
| Rule | One atomic check returning `Status.pass()`, `Status.warn()`, or `Status.fail()` |
| Target | File view rules read through (`fileExists`, `readFile`, `readJson`, `packageJson`) |
| Drift | Any `warn` or `fail` result |

- Many `github/*` rules call the GitHub API and require `CONFORM_GITHUB_API_TOKEN`. Without it they fail, so set the token or disable them.
- Bun is required and Node is unsupported. Preset selection lives in `conform.config.ts`; there is no `--preset` flag.
- Full rule catalog: `references/rules.md`. CLI flags, JSON shapes, and programmatic API: `references/commands.md`.
