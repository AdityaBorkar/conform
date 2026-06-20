import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageJson } from "@/types.ts";

function stripJsonComments(text: string): string {
  return text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export function fileExists(targetPath: string, relPath: string): boolean {
  return existsSync(join(targetPath, relPath));
}

export function readFile(targetPath: string, relPath: string): string | null {
  try {
    return readFileSync(join(targetPath, relPath), "utf-8");
  } catch {
    return null;
  }
}

export function readJson<T = unknown>(
  targetPath: string,
  relPath: string,
): T | null {
  const content = readFile(targetPath, relPath);
  if (content === null) {
    return null;
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    try {
      return JSON.parse(stripJsonComments(content)) as T;
    } catch {
      return null;
    }
  }
}

export function packageJson(targetPath: string): PackageJson | null {
  return readJson<PackageJson>(targetPath, "package.json");
}
