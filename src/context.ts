import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CheckContext, PackageJson } from "@/types.ts";

function stripJsonComments(text: string): string {
  return text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export function createCheckContext(targetPath: string): CheckContext {
  const fileCache = new Map<string, string | null>();

  function readFile(relPath: string): string | null {
    const cached = fileCache.get(relPath);
    if (cached !== undefined) return cached;
    try {
      const content = readFileSync(join(targetPath, relPath), "utf-8");
      fileCache.set(relPath, content);
      return content;
    } catch {
      fileCache.set(relPath, null);
      return null;
    }
  }

  function fileExists(relPath: string): boolean {
    return existsSync(join(targetPath, relPath));
  }

  function readJson<T = unknown>(relPath: string): T | null {
    const content = readFile(relPath);
    if (content === null) return null;
    try {
      return JSON.parse(stripJsonComments(content)) as T;
    } catch {
      return null;
    }
  }

  const packageJson = readJson<PackageJson>("package.json");

  return {
    fileExists,
    packageJson: packageJson ?? null,
    readFile,
    readJson,
    targetPath,
  };
}
