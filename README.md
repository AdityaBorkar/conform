# @adistack/conform

CLI tool that checks repositories against conformance presets.

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

# JSON output
bunx conform check --json

# Show passing checks too
bunx conform check -v
```

### Programmatic API

```ts
import { defineConfig, definePreset, rule } from "@adistack/conform";
```

## Built-in Presets

| Preset | Description |
|----------|-------------|
| `npm-pkg` | Conformance rules for publishing an NPM package |

## Configuration

Create a `conform.config.ts` in your repository root:

```ts
import { defineConfig } from "@/api/index.ts";

export default defineConfig({
  preset: "npm-pkg",
});
```

## License

MIT
