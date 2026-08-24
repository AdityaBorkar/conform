import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Preset } from "@/types.ts";

const packageRoot = resolve(import.meta.dir, "..", "..");
const presetsDir = join(packageRoot, "src", "presets");

function isValidPreset(value: unknown): value is Preset {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v["name"] === "string" &&
    typeof v["description"] === "string" &&
    Array.isArray(v["plugins"]) &&
    (v["rules"] === undefined ||
      (typeof v["rules"] === "object" &&
        v["rules"] !== null &&
        !Array.isArray(v["rules"])))
  );
}

export async function presetResolver(name: string): Promise<Preset | null> {
  const flatPath = join(presetsDir, `${name}.ts`);
  const indexPath = join(presetsDir, name, "index.ts");

  const candidatePaths = [flatPath, indexPath].filter((p) => existsSync(p));

  if (candidatePaths.length === 0) {
    return null;
  }

  for await (const candidate of candidatePaths) {
    try {
      const mod = await import(candidate);
      const preset: unknown = mod.default ?? mod;

      if (isValidPreset(preset)) {
        return preset;
      }
    } catch {
      // skip unparseable presets
    }
  }
  return null;
}

export function definePreset(preset: Preset): Preset {
  return preset;
}
