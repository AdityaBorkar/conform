import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageJson } from "@/types.ts";

function stripJsonComments(text: string): string {
  return text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export class Target {
  // biome-ignore lint/style/noParameterProperties: concise Target binding is intentional
  constructor(readonly path: string) {}

  fileExists(rel: string): boolean {
    return existsSync(join(this.path, rel));
  }

  readFile(rel: string): string | null {
    try {
      return readFileSync(join(this.path, rel), "utf-8");
    } catch {
      return null;
    }
  }

  readJson<T>(rel: string): T | null {
    const content = this.readFile(rel);
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

  packageJson(): PackageJson | null {
    return this.readJson<PackageJson>("package.json");
  }
}

export function createTarget(path: string): Target {
  return new Target(path);
}

export function fileExists(target: Target, relPath: string): boolean {
  return target.fileExists(relPath);
}

export function readFile(target: Target, relPath: string): string | null {
  return target.readFile(relPath);
}

export function readJson<T = unknown>(
  target: Target,
  relPath: string,
): T | null {
  return target.readJson<T>(relPath);
}

export function packageJson(target: Target): PackageJson | null {
  return target.packageJson();
}
