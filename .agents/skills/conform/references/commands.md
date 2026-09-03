# Commands, output, and programmatic API

## CLI

```sh
conform check [--path <dir>] [--json] [-v] [--group files]
```

| Flag | Default | Meaning |
|---|---|---|
| `--path <dir>` | Current directory | Repository to check |
| `--json` | Off | Machine-readable output; rejects `--group` (exit 1) |
| `-v, --verbose` | Off | Include passing checks |
| `--group files` | Group by domain | Group output by file instead |

```sh
bunx conform check                      # current directory
bunx conform check --path ./my-project  # another directory
bunx conform check -v --group files     # everything, grouped by file
bunx conform check --json > out.json    # JSON for CI
```

## Human output (default)

Results group by domain, then by file. Passing rows hide without `-v`; the summary always counts everything:

```
@adistack/conform — package preset

Build & Tasks
  package.json
    ✓ required-fields   all fields are present
    ✗ entry-point       no main, module, or exports field

Summary: 32 passed · 2 warned · 1 failed
```

## JSON output

```json
{
  "preset": "package",
  "path": "/abs/path",
  "results": [{ "id": "package-json/entry-point", "status": "fail", "message": "…" }],
  "summary": { "pass": 32, "warn": 2, "fail": 1 }
}
```

`results` holds visible rows only (`-v` includes passes); `summary` counts everything. Monorepo JSON uses `{ "path", "outputs": [ConformOutput], "summary" }` with one block per package plus `Summary: N passed · N warned · N failed across M packages` in text mode.

## Monorepo config

```ts
import { defineMonorepoConfig } from "@adistack/conform";

export default defineMonorepoConfig({
  ".": { preset: "package" },
  "packages/app": { preset: "package" },
  "packages/lib": { preset: "package", rules: { "biome/dev-deps": "off" } },
});
```

Keys are package directories (relative recommended). Every workspace needs a key, every key must match a workspace, and the root `package.json` needs `workspaces`. Violations exit 2: `monorepo-no-workspaces`, `monorepo-unconfigured-package`, `monorepo-extraneous-package`, `monorepo-config-error`.

## Programmatic API

```ts
import { check } from "@adistack/conform";

const result = await check("/path/to/repo", { verbose: true });

if ("code" in result) {
  console.error(result.code, result.message); // no-config, preset-not-found, monorepo-*
} else if ("packageResults" in result) {
  console.log(result.summary); // monorepo
} else {
  console.log(result.output.summary, result.hasFail); // single package
}
```

Key exports from `@adistack/conform`: `defineConfig`, `defineMonorepoConfig`, `definePlugin`, `definePreset`, `presetResolver`, `Status`, `DOMAIN`, `Target`, `check`, `checkMonorepo`, `runChecks`, `isConformanceError`, `isMonorepoConformanceResult`. Built-ins live at `@adistack/conform/plugins`. Source map: engine `src/api/engine.ts`, plugin base `src/api/plugin.ts`, presets `src/api/preset.ts`, types `src/types.ts`.
