import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

export const gitignoreRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists(".gitignore")) {
        return { status: "pass" };
      }
      return { message: ".gitignore not found", status: "fail" };
    },
    description: ".gitignore exists",
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".gitignore"],
    id: "files:gitignore",
  }),
  defineRule({
    check: (ctx) => {
      const gitignore = ctx.readFile(".gitignore");
      if (!gitignore) {
        return {
          message: ".gitignore not found — skipping content check",
          status: "pass",
        };
      }
      if (gitignore.includes("node_modules")) {
        return { status: "pass" };
      }
      return {
        message:
          '.gitignore does not include "node_modules" — accidentally committing it is catastrophic',
        status: "fail",
      };
    },
    description: '.gitignore contains "node_modules"',
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".gitignore"],
    id: "gitignore:node-modules",
  }),
  defineRule({
    check: (ctx) => {
      const gitignore = ctx.readFile(".gitignore");
      if (!gitignore) {
        return {
          message: ".gitignore not found — skipping content check",
          status: "pass",
        };
      }
      if (/^\.env/m.test(gitignore) || /\.env\*/m.test(gitignore)) {
        return { status: "pass" };
      }
      return {
        message:
          '.gitignore does not include ".env" — secrets must never be committed',
        status: "fail",
      };
    },
    description: '.gitignore contains ".env"',
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".gitignore"],
    id: "gitignore:env",
  }),
];
