import { readJson } from "@/utils/fs.ts";

export interface JsrConfig {
  description?: string;
  exports?: Record<string, string> | string;
  name?: string;
  runtimeCompat?: {
    deno?: boolean;
    node?: boolean;
    bun?: boolean;
    browser?: boolean;
    workerd?: boolean;
  };
  version?: string;
}

export function resolveJsrConfig(targetPath: string): {
  jsr: JsrConfig | null;
  source: string;
} {
  const jsr = readJson<JsrConfig>(targetPath, "jsr.json");
  if (jsr) {
    return { jsr, source: "jsr.json" };
  }
  const deno = readJson<JsrConfig>(targetPath, "deno.json");
  if (deno) {
    return { jsr: deno, source: "deno.json" };
  }
  return { jsr: null, source: "package.json" };
}

export function getExportPaths(targetPath: string): string[] {
  const config = resolveJsrConfig(targetPath);
  const exports = config.jsr?.exports;
  if (!exports) {
    return [];
  }
  if (typeof exports === "string") {
    return [exports];
  }
  return Object.values(exports);
}
