import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Template } from "@/types.ts";

const packageRoot = resolve(import.meta.dir, "..", "..");
const templatesDir = join(packageRoot, "templates");

export async function resolver(name: string): Promise<Template | null> {
  const indexPath = join(templatesDir, name, "index.ts");
  if (!existsSync(indexPath)) {
    return null;
  }
  try {
    const mod = await import(indexPath);
    const template: Template = mod.default ?? mod;
    if (template.name && Array.isArray(template.rules)) {
      return template;
    }
  } catch {
    // skip unparseable templates
  }
  return null;
}
