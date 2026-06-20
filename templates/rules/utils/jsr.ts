import type { CheckContext } from "@/types.ts";

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

export function resolveJsrConfig(ctx: CheckContext): {
  jsr: JsrConfig | null;
  source: string;
} {
  const jsr = ctx.readJson<JsrConfig>("jsr.json");
  if (jsr) {
    return { jsr, source: "jsr.json" };
  }
  const deno = ctx.readJson<JsrConfig>("deno.json");
  if (deno) {
    return { jsr: deno, source: "deno.json" };
  }
  return { jsr: null, source: "package.json" };
}

export function getExportPaths(ctx: CheckContext): string[] {
  const config = resolveJsrConfig(ctx);
  const exports = config.jsr?.exports;
  if (!exports) {
    return [];
  }
  if (typeof exports === "string") {
    return [exports];
  }
  return Object.values(exports);
}
