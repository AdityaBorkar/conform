# @adistack/conform

CLI that checks repositories against conformance presets. Supports single-package and monorepo (`defineMonorepoConfig`) workspaces — see `/CONTEXT.md` and `docs/architecture.md`.

## Install

```sh
bun add -d @adistack/conform
```

Bun only. No build: `exports: "." → ./src/index.ts`, `files: ["src","README.md"]`, `bin: conform → src/cli/index.ts`.

## Usage

### CLI

```sh
# Check the current directory
bunx conform check

# Check a specific directory
bunx conform check --path ./my-project

# JSON output (mutually exclusive with --group)
bunx conform check --json

# Show passing checks too
bunx conform check -v

# Group by file instead of domain
bunx conform check --group files
```

Exit codes: `0` all pass · `1` any fail (takes priority) or `--json`+`--group` misuse · `2` warn-only, no `conform.config.ts`, preset not found, or monorepo config errors (`monorepo-no-workspaces` / `monorepo-unconfigured-package` / `monorepo-extraneous-package` / `monorepo-config-error`).

### Configuration

Single-package — `conform.config.ts` in repo root:

```ts
import { defineConfig } from "@adistack/conform";

export default defineConfig({
  preset: "package",
  // optional tuning (oxc-style):
  // plugins: [myPlugin],
  // rules: { "biome/dev-deps": "warn", "package-json/no-install-hooks": "off" },
  // with params flattened (level optional): "gitignore/excludes": { level: "error", file_expressions: ["node_modules"] },
  // or just { file_expressions: ["node_modules"] } without level, or "gitignore/excludes": "off"
});
```

Monorepo — `conform.config.ts` at workspace root (`package.json:workspaces` required):

```ts
import { defineMonorepoConfig } from "@adistack/conform";

export default defineMonorepoConfig({
  "packages/app": { preset: "package" },
  "packages/lib": { preset: "package", rules: { "docs/changelog": "off" } },
});
```

`rules` values are `RuleLevel` string (`"off" | "warn" | "error"`) or flat object `{ level?: "off"|"warn"|"error", ...params }` where `...params` is validated by the rule's arktype schema (no `params` wrapper, `level` optional). Non-pass results are coerced to the configured severity; `pass` stays `pass` (intentionally allowing suppression). Unknown severity strings fail the rule with `Invalid severity "…"` (fail-closed).

### Programmatic API

```ts
import { defineConfig, definePreset, definePlugin, DOMAIN, Status } from "@adistack/conform";
import type { Target } from "@adistack/conform";

// Plugin-owned rule (all Rules must belong to a Plugin)
export const myPlugin = definePlugin({
  id: "my-plugin",
  context: (target: Target) => ({ target }),
});

myPlugin.defineRule({
  id: "my-rule",
  domain: DOMAIN.STYLE,
  name: "biome.json exists",
  test: ({ context }) => (context.target.fileExists("biome.json") ? Status.pass() : Status.fail("missing biome.json")),
});

// Preset — curried form infers StrictPresetRules from the plugin tuple:
export default definePreset([myPlugin] as const)({
  name: "my-preset",
  description: "My preset",
  rules: { "my-plugin/my-rule": "warn" },
});
```

`definePreset(plugins)(config)` (curried) and `definePreset({ name, description, plugins, rules? })` (object) are both accepted; presets live in `src/presets/*.ts` and resolve via `presetResolver` (`src/presets/<name>.ts` or `src/presets/<name>/index.ts`).

See [`/CONTEXT.md`](./CONTEXT.md) for terminology and [`docs/architecture.md`](./docs/architecture.md) for full authoring, engine (single-package + monorepo dispatch), and output details.

## Built-in Presets

| Preset | Description |
|--------|-------------|
| `package` | Conformance rules for publishing an NPM package (9 plugins, 37 rules — see `docs/architecture.md`) |

## License

MIT
