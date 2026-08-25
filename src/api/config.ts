import type { ConformConfig, MonorepoConfig } from "@/types.ts";

export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}

export function defineMonorepoConfig(config: MonorepoConfig): MonorepoConfig {
  return config;
}

export function isConformConfig(value: unknown): value is ConformConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v["preset"] === "string" && (v["preset"] as string).length > 0;
}

export function isMonorepoConfig(value: unknown): value is MonorepoConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  // Single config has top-level preset; monorepo must not
  if ("preset" in rec) {
    return false;
  }
  const entries = Object.entries(rec);
  if (entries.length === 0) {
    return false;
  }
  return entries.every(([, v]) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return false;
    }
    const inner = v as Record<string, unknown>;
    return (
      typeof inner["preset"] === "string" &&
      (inner["preset"] as string).length > 0
    );
  });
}
