# House Style — human-friendly, agent-friendly, code-true docs

Every docs change satisfies all three lenses. A page ships only when each lens below holds.

## Human lens: task first

- One page, one job. Title with the task verb (`Fix Drift`, `Custom Check`); first paragraph states what the reader achieves.
- Order pages by journey: `quick-start` → `concepts` → `configuration` → `cli` → `monorepo` → examples (`fix-drift`, `custom-rule`) → reference (`presets`, `plugins`, `authoring`, `api`).
- Numbered steps that run in order. Each step holds one command or file edit plus its expected output.
- Prefer before/after pairs: failing output, the fix (`package.json`, `conform.config.ts`), passing output with exit code.
- State the guideline plainly: fix first, mute last. `off` is a last resort for rules that genuinely do not apply; `warn` is a temporary bridge with a prompt fix.
- Close how-to pages with troubleshooting: symptom → cause → fix table (missing config, wrong preset name, `--json`+`--group` clash, `Invalid severity`, Node runtime).
- Keep sentences short, address the reader as you, name files by exact path (`conform.config.ts`, `biome.json`).

## Agent lens: exact and copyable

- Use canonical terms exactly per `/CONTEXT.md`: `Preset` (never `preset`/`Template`), `Plugin` (never `RuleSet`), `presetResolver` (never `resolver`), `domain`+`files` (never `group`), `package` (never `npm-pkg`). Repeat the canonical table from `concepts.mdx` rather than paraphrasing it.
- Quote rule IDs fully namespaced, always: `package-json/entry-point`, never bare `entry-point`. Quote severities and statuses exactly: `pass`/`warn`/`fail` versus `off`/`warn`/`error`.
- Anchor behavior claims to files with line hints: `src/api/engine.ts:48`, `src/cli/check.ts:46`, `src/utils/config.ts:7`. Add an `Agent hint:` line where inference lives (registry inference via `src/plugins/index.ts` barrel, `EXPECTED_*` defaults in `src/plugins/*.ts`, `Bun.Glob` expansion in `expandWorkspaces`).
- Ship copy-pasteable blocks with titles: ````ts title="conform.config.ts"````, ````sh```` for commands, ````json```` for `--json` payloads. Imports come from `@adistack/conform` root; note the second entry point `@adistack/conform/plugins` and the `#/* → ./src/*` alias where relevant.
- State invariants agents rely on: `pass` never coerces; `off` skips without running `check`; unknown severity and invalid params fail closed without running `test`; `summary` counts all results while `verbose` filters rows only; `hasFail` dominates `hasWarn`; unknown `--group` falls through to `domains`.
- Record exit codes as a table on every behavioral page: `0` all pass · `1` any fail or `--json`+`--group` misuse · `2` warn-only, `no-config`, `preset-not-found`, monorepo errors.

## Code lens: docs trace to src

- Read the source before writing. Rule tables derive from `src/plugins/*.ts`; preset counts and pre-tuned rules from `src/presets/package.ts`; flags from `src/cli/index.ts`; JSON shapes from `src/types.ts`.
- Document params flat with defaults: `{ level?, ...params }`, no `params` wrapper, `level` optional. Show both forms: `"biome/format-script": "warn"` and `"gitignore/excludes": { file_expressions: [...] }`.
- Mark severity defaults per rule (`(warn)` annotations) and token-gated rules (`Requires a token` for `github/*` API rules plus the `CONFORM_GITHUB_API_TOKEN` export or the `off` escape).
- Never invent counts or defaults from memory. Grep the plugin files, count the `defineRule` calls, read the `EXPECTED_*` constants, then write the number.
- Point at code for depth instead of duplicating it: `Full param defaults live in src/plugins/*.ts.` Keep the one-line check column to a single question per rule.

## Verification checklist (Branch B bar)

Apply every row before calling an audit done:

- [ ] Every `plugin-id/rule-id` in `www/` resolves to a `defineRule` in `src/plugins/`.
- [ ] Rule counts (`presets.mdx`, `plugins.mdx`, skill compact tables) equal the `defineRule` grep count.
- [ ] Severity `(warn)` markers match each rule's declared default.
- [ ] Every `ts`/`sh` snippet was executed (config snippet typechecks, CLI command runs, JSON shape matches `--json` output).
- [ ] Exit-code tables match `src/cli/check.ts` + `src/api/engine.ts` semantics.
- [ ] Canonical terms match `/CONTEXT.md`; no banned alias appears.
- [ ] `www/meta.json` page order matches the journey order above.
