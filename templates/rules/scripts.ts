import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

export const scriptsRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts ?? {};
      const typecheckScript =
        scripts.typecheck ?? scripts["check:types"] ?? scripts.types;
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
    domain: DOMAIN.BUILD,
    files: ["package.json"],
    id: "scripts:typecheck",
  }),
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts;
      if (scripts?.prepublish) {
        return {
          message:
            'prepublish script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.',
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "deprecated prepublish script is not used",
    domain: DOMAIN.BUILD,
    files: ["package.json"],
    id: "scripts:no-prepublish",
  }),
];
