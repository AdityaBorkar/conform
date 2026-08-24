import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageJson } from "@/types.ts";

function stripJsonComments(text: string): string {
  return text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function resolveBase(targetPath: string | Target): string {
  return typeof targetPath === "string" ? targetPath : targetPath.path;
}

export class Target {
  // biome-ignore lint/style/noParameterProperties: concise Target binding is intentional
  constructor(readonly path: string) {}

  fileExists(rel: string): boolean {
    return fileExists(this.path, rel);
  }

  readFile(rel: string): string | null {
    return readFile(this.path, rel);
  }

  readJson<T>(rel: string): T | null {
    return readJson<T>(this.path, rel);
  }

  packageJson(): PackageJson | null {
    return packageJson(this.path);
  }

  toString(): string {
    return this.path;
  }

  valueOf(): string {
    return this.path;
  }

  [Symbol.toPrimitive](): string {
    return this.path;
  }
}

export function createTarget(path: string): Target {
  return new Target(path);
}

export function fileExists(
  targetPath: string | Target,
  relPath: string,
): boolean {
  return existsSync(join(resolveBase(targetPath), relPath));
}

export function readFile(
  targetPath: string | Target,
  relPath: string,
): string | null {
  try {
    return readFileSync(join(resolveBase(targetPath), relPath), "utf-8");
  } catch {
    return null;
  }
}

export function readJson<T = unknown>(
  targetPath: string | Target,
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

export function packageJson(targetPath: string | Target): PackageJson | null {
  return readJson<PackageJson>(targetPath, "package.json");
}
