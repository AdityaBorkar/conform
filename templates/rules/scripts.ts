import type { Rule } from "@/types.ts";

import { build } from "./domains.ts";

export const scriptsRules: Rule[] = [
  build.rule({
    check: (ctx) => {
      const scripts = ctx.packageJson?.scripts ?? {};
      const typecheckScript =
        scripts["typecheck"] ?? scripts["check:types"] ?? scripts["types"];
      if (typecheckScript) {
        return { message: typecheckScript, status: "pass" };
      }
      return {
        message:
          "no typecheck script found — add a typecheck or check:types script running tsc --noEmit",
        status: "warn",
      };
    },
    description: "typecheck script exists",
    files: ["package.json"],
    id: "scripts:typecheck",
  }),
  build.rule({
    check: (ctx) => {
      const scripts = ctx.packageJson?.scripts;
      if (scripts?.["prepublish"]) {
        return {
          message:
            'prepublish script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.',
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "deprecated prepublish script is not used",
    files: ["package.json"],
    id: "scripts:no-prepublish",
  }),
];
