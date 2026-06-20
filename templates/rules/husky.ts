import type { Rule } from "@/types.ts";

import { build, devEnv } from "./domains.ts";

export const huskyRules: Rule[] = [
  build.rule({
    check: (ctx) => {
      const prepare = ctx.packageJson?.scripts?.["prepare"];
      if (prepare?.includes("husky")) {
        return { message: prepare, status: "pass" };
      }
      if (!prepare) {
        return { message: "no prepare script found", status: "fail" };
      }
      return {
        message: `prepare is "${prepare}", expected to call husky`,
        status: "fail",
      };
    },
    description: "prepare script calls husky",
    files: ["package.json"],
    id: "husky:prepare-script",
  }),
  devEnv.rule({
    check: (ctx) => {
      const huskyVersion = ctx.packageJson?.devDependencies?.["husky"];
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
    files: ["package.json"],
    id: "husky:dev-deps",
  }),
  devEnv.rule({
    check: (ctx) => {
      if (ctx.fileExists(".husky")) {
        return { status: "pass" };
      }
      return { message: ".husky/ directory not found", status: "fail" };
    },
    description: ".husky/ directory exists",
    files: [".husky/"],
    id: "husky:hooks-dir",
  }),
  devEnv.rule({
    check: (ctx) => {
      if (ctx.fileExists(".husky/pre-commit")) {
        return { status: "pass" };
      }
      return { message: "no pre-commit hook found", status: "warn" };
    },
    description: "pre-commit hook exists",
    files: [".husky/pre-commit"],
    id: "husky:pre-commit-hook",
  }),
  devEnv.rule({
    check: (ctx) => {
      if (ctx.fileExists(".husky/commit-msg")) {
        return { status: "pass" };
      }
      return { message: "no commit-msg hook found", status: "warn" };
    },
    description: "commit-msg hook exists",
    files: [".husky/commit-msg"],
    id: "husky:commit-msg-hook",
  }),
];
