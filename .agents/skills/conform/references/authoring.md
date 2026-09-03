# Authoring Plugins and Presets

Every rule belongs to a plugin. There is no standalone `defineRule`.

## 1. Create a plugin

Give it an ID and a context factory. The factory receives a Target and returns the helpers your rules need:

```ts
import { definePlugin } from "@adistack/conform";
import type { Target } from "@adistack/conform";

export const myPlugin = definePlugin({
  id: "my-plugin",
  context: (target: Target) => ({
    fileExists: (p: string) => target.fileExists(p),
    readFile: (p: string) => target.readFile(p),
  }),
});
```

## 2. Add rules (one rule, one job)

```ts
import { DOMAIN, Status } from "@adistack/conform";
import { type } from "arktype";

myPlugin.defineRule({
  id: "readme",
  domain: DOMAIN.DOCUMENTATION,
  name: "README.md exists",
  test({ context }) {
    return context.fileExists("README.md")
      ? Status.pass()
      : Status.fail("README.md not found");
  },
});

myPlugin.defineRule({
  id: "hook-pattern",
  domain: DOMAIN.DEV_ENVIRONMENT,
  name: "hook has pattern",
  files: [".husky/pre-commit"],
  params: type({ pattern: "string" }),
  test({ context, params }) {
    const text = context.readFile(".husky/pre-commit") ?? "";
    return text.includes(params?.pattern ?? "")
      ? Status.pass()
      : Status.fail("pattern missing");
  },
});
```

Field rules: `id`, `domain`, `name`, and `test` are required. `domain` uses `DOMAIN.*` with no plugin-level default. `files` defaults to `[]` and only affects display grouping. Invalid params fail the rule before `test` runs.

## 3. Create a preset

Use the curried form with `as const` so rule params are type-checked:

```ts
import { definePreset } from "@adistack/conform";
import { biome } from "@/plugins/biome.ts";

export default definePreset([myPlugin, biome] as const)({
  name: "acme",
  description: "Acme org defaults",
  rules: {
    "my-plugin/readme": "error",
    "biome/dev-deps": "warn",
  },
});
```

Save it as `src/presets/acme.ts` so `presetResolver` finds it (`src/presets/<name>.ts` or `<name>/index.ts`), then reference it with `preset: "acme"`.

## 4. Consume it

```ts title="conform.config.ts"
import { defineConfig } from "@adistack/conform";
import { myPlugin } from "./my-plugin.ts";

export default defineConfig({
  preset: "package",
  plugins: [myPlugin],
  rules: { "my-org/security-email": "error" },
});
```

Adding `export { foo } from "./foo.ts"` to `src/plugins/index.ts` extends the global `RuleRegistry` automatically. Rules read files through Target only and never use bare `fs`.
