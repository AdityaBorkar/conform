import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { BUILD, DEV_ENV } from "./utils/domains.ts";

export const huskyRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const prepare = ctx.packageJson()?.scripts?.["prepare"];
      if (prepare?.includes("husky")) {
        return { message: prepare, status: "pass" };
      }
      if (!prepare) {
        return { message: "no prepare script found", status: "fail" };
      }
      s;
      return {
        message: `prepare is "${prepare}", expected to call husky`,
        status: "fail",
      };
    },
    description: "prepare script calls husky",
    domain: BUILD,
    files: ["package.json"],
    id: "husky:prepare-script",
  }),
  defineRule({
    check: (ctx) => {
      const huskyVersion = ctx.packageJson()?.devDependencies?.["husky"];
      if (huskyVersion) {
        return {
          message: huskyVersion,
          status: "pass",
        };
      }
      return {
        message: "husky not found in devDependencies",
        status: "fail",
      };
    },
    description: "husky in devDependencies",
    domain: DEV_ENV,
    files: ["package.json"],
    id: "husky:dev-deps",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists(".husky")) {
        return { status: "pass" };
      }
      return { message: ".husky/ directory not found", status: "fail" };
    },
    description: ".husky/ directory exists",
    domain: DEV_ENV,
    files: [".husky/"],
    id: "husky:hooks-dir",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists(".husky/pre-commit")) {
        return { status: "pass" };
      }
      return { message: "no pre-commit hook found", status: "warn" };
    },
    description: "pre-commit hook exists",
    domain: DEV_ENV,
    files: [".husky/pre-commit"],
    id: "husky:pre-commit-hook",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists(".husky/commit-msg")) {
        return { status: "pass" };
      }
      return { message: "no commit-msg hook found", status: "warn" };
    },
    description: "commit-msg hook exists",
    domain: DEV_ENV,
    files: [".husky/commit-msg"],
    id: "husky:commit-msg-hook",
  }),
];
