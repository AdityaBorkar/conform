import type { Rule } from "@/types.ts";

import { devEnv, security } from "./domains.ts";

export const filesRules: Rule[] = [
  devEnv.rule({
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
    files: [
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
    id: "lockfile:exists",
  }),
  security.rule({
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
    files: ["LICENSE", "LICENSE.md", "LICENSE.txt"],
    id: "files:license",
  }),
  security.rule({
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
    files: ["SECURITY.md", ".github/SECURITY.md"],
    id: "files:security-md",
  }),
];
