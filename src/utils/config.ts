import { isAbsolute, join, relative, resolve } from "node:path";

import { isConformConfig, isMonorepoConfig } from "@/api/config.ts";
import type { ConformConfig, MonorepoConfig } from "@/types.ts";
import { expandWorkspaces } from "@/utils/workspaces.ts";

export async function loadConfig(
  targetPath: string,
): Promise<ConformConfig | null> {
  const configPath = join(targetPath, "conform.config.ts");
  try {
    const mod = await import(configPath);
    const config: ConformConfig = mod.default ?? mod;
    if (config.preset) {
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadRawConfig(
  targetPath: string,
): Promise<unknown | null> {
  const configPath = join(targetPath, "conform.config.ts");
  try {
    const mod = await import(configPath);
    return (mod.default ?? mod) as unknown;
  } catch {
    return null;
  }
}

export type ResolvedMonorepoMapping = Map<string, ConformConfig>;

/**
 * Normalize monorepo config keys to absolute paths and validate against
 * discovered workspace packages.
 *
 * Throws an Error if:
 *  - any workspace package has no matching entry
 *  - an entry key resolves to a path outside or with no package.json
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates config against discovered workspaces
export function resolveMonorepoPackages(
  rootDir: string,
  monorepoConfig: MonorepoConfig,
  discovered: string[],
): ResolvedMonorepoMapping {
  const normalized = new Map<string, ConformConfig>();
  for (const [rawKey, entry] of Object.entries(monorepoConfig)) {
    const absKey = isAbsolute(rawKey)
      ? resolve(rawKey)
      : resolve(rootDir, rawKey);
    normalized.set(absKey, entry);
  }

  // Error if any discovered package lacks config
  for (const pkgPath of discovered) {
    if (!normalized.has(pkgPath)) {
      const rel = relative(rootDir, pkgPath) || ".";
      throw new Error(
        `No preset/rules defined for workspace package "${rel}" (${pkgPath}): missing key in defineMonorepoConfig`,
      );
    }
  }

  // Also error if config contains key not in discovered (extraneous)
  for (const absKey of normalized.keys()) {
    if (!discovered.includes(absKey)) {
      const rel = relative(rootDir, absKey) || absKey;
      throw new Error(
        `Monorepo config entry "${rel}" does not match any workspace package discovered from package.json workspaces`,
      );
    }
  }

  // Ensure entries are valid ConformConfig (preset)
  for (const [absKey, entry] of normalized) {
    if (!isConformConfig(entry)) {
      const rel = relative(rootDir, absKey) || absKey;
      throw new Error(`Invalid ConformConfig for "${rel}": preset is required`);
    }
  }

  // Return in discovered order
  const ordered = new Map<string, ConformConfig>();
  for (const pkgPath of discovered) {
    const entry = normalized.get(pkgPath);
    if (entry) {
      ordered.set(pkgPath, entry);
    }
  }
  return ordered;
}

export async function loadAndResolveMonorepo(rootDir: string): Promise<{
  config: MonorepoConfig;
  discovered: string[];
  mapping: ResolvedMonorepoMapping;
} | null> {
  const raw = await loadRawConfig(rootDir);
  if (raw === null) {
    return null;
  }
  if (!isMonorepoConfig(raw)) {
    return null;
  }
  const discovered = expandWorkspaces(rootDir);
  const mapping = resolveMonorepoPackages(rootDir, raw, discovered);
  return { config: raw, discovered, mapping };
}
