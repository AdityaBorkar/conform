import { type } from "arktype";

import type { ConformConfig, MonorepoConfig } from "@/types.ts";

const conformConfigSchema = type({
  preset: "string>0",
});

const monorepoConfigSchema = type({
  "[string]": conformConfigSchema,
}).narrow((data, ctx) => {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return ctx.mustBe("an object");
  }
  // Single config has top-level preset; monorepo must not
  if ("preset" in (data as Record<string, unknown>)) {
    return ctx.mustBe("a monorepo mapping (must not have top-level preset)");
  }
  if (Object.keys(data as object).length === 0) {
    return ctx.mustBe("non-empty");
  }
  return true;
});

export function isConformConfig(value: unknown): value is ConformConfig {
  return !(conformConfigSchema(value) instanceof type.errors);
}

export function isMonorepoConfig(value: unknown): value is MonorepoConfig {
  return !(monorepoConfigSchema(value) instanceof type.errors);
}

export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}

export function defineMonorepoConfig(config: MonorepoConfig): MonorepoConfig {
  return config;
}
