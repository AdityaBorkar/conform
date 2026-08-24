# @adistack/conform

CLI that checks repositories against conformance presets.

## Install

```sh
bun add -d @adistack/conform
```

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

Exit codes: `0` all pass · `1` any fail (takes priority) or `--json`+`--group` misuse · `2` warn-only, no `conform.config.ts`, or preset not found.

### Configuration

Create `conform.config.ts` in your repository root:

```ts
import { defineConfig } from "@adistack/conform";

export default defineConfig({
  preset: "package",
  // optional tuning (oxc-style):
  // plugins: [myPlugin],
  // rules: { "biome:dev-deps": "warn", "package-json:no-install-hooks": "off" },
});
```

`rules` values are `off | warn | error | fail | pass` or `[severity, params]` where `params` is validated by the rule's arktype schema. Non-pass results are coerced to the configured severity; `pass` stays `pass`.

### Programmatic API

```ts
import { defineConfig, definePreset, definePlugin, defineRule, Status, presetResolver } from "@adistack/conform";
import { DOMAIN } from "@adistack/conform/plugins/utils/domain.ts";

// Standalone rule
export const myRule = defineRule({
  id: "my-plugin:my-rule",
  domain: DOMAIN.STYLE,
  files: ["biome.json"],
  description: "biome.json exists",
  check: (targetPath) => Status.pass(),
});
```

See [`/CONTEXT.md`](./CONTEXT.md) for terminology and [`docs/architecture.md`](./docs/architecture.md) for full authoring, engine, and output details.

## Built-in Presets

| Preset | Description |
|--------|-------------|
| `package` | Conformance rules for publishing an NPM package |

Other presets (`astro-site`, `monorepo`, `react-site`, `webapp`) are stubs.

## License

MIT
