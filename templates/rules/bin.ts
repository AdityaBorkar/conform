import type { Rule } from "@/types.ts";

import { build } from "./domains.ts";
import { getBinPaths } from "./utils/bin.ts";

export const binRules: Rule[] = [
  build.rule({
    check: (ctx) => {
      const binPaths = getBinPaths(ctx.packageJson ?? {});
      if (binPaths.length === 0) {
        return {
          message: "no bin field — skipping bin file check",
          status: "pass",
        };
      }
      const missing = binPaths.filter((p) => !ctx.fileExists(p));
      if (missing.length > 0) {
        return {
          message: `bin path(s) not found on disk: ${missing.join(", ")}`,
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "bin field references files that exist",
    files: ["package.json"],
    id: "bin:file-exists",
  }),
  build.rule({
    check: (ctx) => {
      const binPaths = getBinPaths(ctx.packageJson ?? {});
      if (binPaths.length === 0) {
        return {
          message: "no bin field — skipping shebang check",
          status: "pass",
        };
      }
      const missingShebang: string[] = [];
      for (const binPath of binPaths) {
        const content = ctx.readFile(binPath);
        if (content === null) {
          continue;
        }
        const firstLine = content.split("\n")[0];
        if (!firstLine?.startsWith("#!")) {
          missingShebang.push(binPath);
        }
      }
      if (missingShebang.length > 0) {
        return {
          message: `bin file(s) missing shebang (#!/usr/bin/env node or bun): ${missingShebang.join(", ")}`,
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "bin entry files have a shebang line",
    files: ["package.json"],
    id: "bin:shebang",
  }),
];
