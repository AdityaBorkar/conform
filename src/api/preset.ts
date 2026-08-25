import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type {
  AnyPlugin,
  Preset,
  PresetWithPlugins,
  StrictPresetRules,
} from "@/types.ts";

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

/**
 * Curried form: `definePreset(plugins)(config)` — plugins are captured first
 * so `rules` is checked strictly against those plugins' inferred param map.
 * Object form `definePreset({ plugins, rules })` is preserved for backwards
 * compatibility; both infer `Ps` as `const` tuple for full type-safety.
 */
export function definePreset<const Ps extends readonly AnyPlugin[]>(
  plugins: Ps,
): (config: {
  description: string;
  name: string;
  rules?: StrictPresetRules<Ps>;
}) => PresetWithPlugins<Ps>;
export function definePreset<const Ps extends readonly AnyPlugin[]>(config: {
  description: string;
  name: string;
  plugins: Ps;
  rules?: StrictPresetRules<Ps>;
}): PresetWithPlugins<Ps>;
export function definePreset<const Ps extends readonly AnyPlugin[]>(
  arg0:
    | Ps
    | {
        description: string;
        name: string;
        plugins: Ps;
        rules?: StrictPresetRules<Ps>;
      },
  _arg1?: unknown,
): unknown {
  // curried: definePreset(plugins)(config)
  if (Array.isArray(arg0)) {
    const plugins = arg0 as Ps;
    return (config: {
      description: string;
      name: string;
      rules?: StrictPresetRules<Ps>;
    }) => ({ ...config, plugins }) as unknown as PresetWithPlugins<Ps>;
  }
  // object: definePreset({ plugins, ... })
  return arg0 as unknown as PresetWithPlugins<Ps>;
}
