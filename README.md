# @adityab/conform

CLI tool that checks repositories against conformance templates.

## Install

```sh
bun add -d @adityab/conform
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
import { defineConfig, defineTemplate, rule } from "@adityab/conform";
```

## Built-in Templates

| Template | Description |
|----------|-------------|
| `npm-pkg` | Conformance rules for publishing an NPM package |

## Configuration

Create a `conform.config.ts` in your repository root:

```ts
import { defineConfig } from "@/conform-api/index.ts";

export default defineConfig({
  template: "npm-pkg",
});
```

## License

MIT
