import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Template } from "@/types.ts";

const packageRoot = resolve(import.meta.dir, "..", "..");
const templatesDir = join(packageRoot, "templates");

function isValidTemplate(value: unknown): value is Template {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v["name"] === "string" &&
    Array.isArray(v["plugins"]) &&
    (v["rules"] === undefined ||
      (typeof v["rules"] === "object" &&
        v["rules"] !== null &&
        !Array.isArray(v["rules"])))
  );
}

function isLegacyTemplate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v["name"] === "string" && Array.isArray(v["rules"]);
}

export async function resolver(name: string): Promise<Template | null> {
  // Support both flat file `templates/<name>.ts` and directory `templates/<name>/index.ts`
  const flatPath = join(templatesDir, `${name}.ts`);
  const indexPath = join(templatesDir, name, "index.ts");

  const candidatePaths = [flatPath, indexPath].filter((p) => existsSync(p));

  if (candidatePaths.length === 0) {
    return null;
  }

  for await (const candidate of candidatePaths) {
    try {
      const mod = await import(candidate);
      const template: unknown = mod.default ?? mod;

      if (isValidTemplate(template)) {
        return template;
      }

      // Back-compat: legacy templates used `rules: Rule[]` instead of `plugins`
      if (isLegacyTemplate(template)) {
        const legacy = template as {
          description: string;
          name: string;
          rules: import("@/types.ts").Rule[];
        };
        const first = legacy.rules[0] as unknown as
          | import("@/types.ts").Rule
          | undefined;
        if (first && typeof first.check === "function") {
          const synthetic: Template = {
            description: legacy.description,
            name: legacy.name,
            plugins: [{ id: "legacy", rules: legacy.rules }],
          };
          return synthetic;
        }
      }
    } catch {
      // skip unparseable templates
    }
  }
  return null;
}
