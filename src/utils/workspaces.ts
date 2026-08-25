import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
// biome-ignore lint/correctness/noUnresolvedImports: Bun.Glob is provided by Bun runtime
import { Glob } from "bun";

import type { PackageJson } from "@/types.ts";
import { Target } from "@/utils/fs.ts";

export function getWorkspacesPatterns(pkg: PackageJson): string[] | null {
  const ws = pkg.workspaces;
  if (!ws) {
    return null;
  }
  if (Array.isArray(ws)) {
    return ws.filter((p) => typeof p === "string") as string[];
  }
  if (
    typeof ws === "object" &&
    Array.isArray((ws as { packages?: unknown }).packages)
  ) {
    const pkgs = (ws as { packages: unknown[] }).packages;
    return pkgs.filter((p) => typeof p === "string") as string[];
  }
  return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: workspace expansion handles globs, exact paths and dedup
export function expandWorkspaces(rootDir: string): string[] {
  const target = new Target(rootDir);
  const pkg = target.packageJson();
  if (!pkg) {
    throw new Error(
      `No package.json found in ${rootDir} — cannot resolve workspaces`,
    );
  }
  const patterns = getWorkspacesPatterns(pkg);
  if (!patterns || patterns.length === 0) {
    throw new Error(
      `No workspaces field found in ${rootDir}/package.json — cannot resolve monorepo packages`,
    );
  }

  const seen = new Set<string>();
  const results: string[] = [];

  for (const pattern of patterns) {
    if (typeof pattern !== "string" || pattern.length === 0) {
      continue;
    }
    if (pattern.startsWith("!")) {
      continue;
    }
    let matches: string[] = [];
    try {
      const glob = new Glob(pattern);
      matches = [
        ...glob.scanSync({ cwd: rootDir, onlyFiles: false }),
      ] as string[];
    } catch {
      matches = [];
    }

    for (const m of matches) {
      const abs = resolve(rootDir, m);
      if (!existsSync(join(abs, "package.json"))) {
        continue;
      }
      if (!seen.has(abs)) {
        seen.add(abs);
        results.push(abs);
      }
    }

    // Exact path without glob characters: ensure direct check
    const hasGlobChars =
      pattern.includes("*") ||
      pattern.includes("?") ||
      pattern.includes("[") ||
      pattern.includes("{");
    if (!hasGlobChars && matches.length === 0) {
      const abs = resolve(rootDir, pattern);
      if (existsSync(join(abs, "package.json")) && !seen.has(abs)) {
        seen.add(abs);
        results.push(abs);
      }
    }
  }

  results.sort((a, b) => a.localeCompare(b));
  return results;
}
