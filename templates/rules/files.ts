import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

export const filesRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const lockfiles = [
        "bun.lock",
        "bun.lockb",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
      ];
      for (const lf of lockfiles) {
        if (ctx.fileExists(lf)) {
          return { message: lf, status: "pass" };
        }
      }
      return {
        message:
          "no lockfile found — committed lockfiles ensure reproducible installs across environments",
        status: "fail",
      };
    },
    description: "lockfile exists (bun.lock, package-lock.json, etc.)",
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
    id: "lockfile:exists",
  }),
  defineRule({
    check: (ctx) => {
      if (
        ctx.fileExists("LICENSE") ||
        ctx.fileExists("LICENSE.md") ||
        ctx.fileExists("LICENSE.txt")
      ) {
        return { status: "pass" };
      }
      return { message: "no LICENSE file found", status: "fail" };
    },
    description: "LICENSE file exists",
    domain: DOMAIN.SECURITY,
    files: ["LICENSE", "LICENSE.md", "LICENSE.txt"],
    id: "files:license",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists("SECURITY.md")) {
        return { status: "pass" };
      }
      if (ctx.fileExists(".github/SECURITY.md")) {
        return { message: ".github/SECURITY.md", status: "pass" };
      }
      return {
        message:
          "no SECURITY.md found — provides a responsible disclosure path for vulnerability reports",
        status: "warn",
      };
    },
    description: "SECURITY.md exists",
    domain: DOMAIN.SECURITY,
    files: ["SECURITY.md", ".github/SECURITY.md"],
    id: "files:security-md",
  }),
];
