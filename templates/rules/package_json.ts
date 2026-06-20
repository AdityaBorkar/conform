// biome-ignore lint/correctness/noUnresolvedImports: arktype re-exports `type` via a non-standard "ark-ts" exports condition Biome cannot statically resolve; the export exists and tsc validates it
import { type } from "arktype";

import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

const requiredStructure = type({
  bugs: "unknown",
  license: "string",
  name: "string",
  type: "'module'",
  version: "string",
});

const recommendedStructure = type({
  description: "string",
  engines: "Record<string, string>",
  homepage: "string",
  repository: "unknown",
  sideEffects: "boolean | string[]",
});

function summarize(errors: type.errors): string {
  return Object.entries(errors.flatProblemsByPath)
    .map(([field, problems]) => `${field}: ${problems.join(", ")}`)
    .join("; ");
}

export const packageJsonRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const pkg = ctx.packageJson();
      if (!pkg) {
        return { message: "package.json not found", status: "fail" };
      }

      const required = requiredStructure(pkg);
      if (required instanceof type.errors) {
        return { message: summarize(required), status: "fail" };
      }

      const recommended = recommendedStructure(required);
      if (recommended instanceof type.errors) {
        return { message: summarize(recommended), status: "warn" };
      }

      return { status: "pass" };
    },
    description: "package.json structure: required & recommended fields",
    domain: "BUILD",
    files: ["package.json"],
    id: "package-json:structure",
  }),
  defineRule({
    check: (ctx) => {
      const pkg = ctx.packageJson();
      const entries = [
        pkg?.main && "main",
        pkg?.module && "module",
        pkg?.exports && "exports",
      ].filter(Boolean);
      if (entries.length > 0) {
        return { message: entries.join(", "), status: "pass" };
      }
      return {
        message: "no main, module, or exports field defined",
        status: "fail",
      };
    },
    description: "main, module, or exports entry defined",
    domain: DOMAIN.BUILD,
    files: ["package.json"],
    id: "package-json:entry-point",
  }),
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts;
      if (scripts?.prepare) {
        return { message: "prepare", status: "pass" };
      }
      if (scripts?.build) {
        return { message: "build", status: "pass" };
      }
      return { message: "no prepare or build script found", status: "fail" };
    },
    description: "scripts.prepare or scripts.build exists",
    domain: DOMAIN.BUILD,
    files: ["package.json"],
    id: "package-json:build-script",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.packageJson()?.files) {
        return { message: "files field defined", status: "pass" };
      }
      if (ctx.fileExists(".npmignore")) {
        return { message: ".npmignore exists", status: "pass" };
      }
      return {
        message: "no files field or .npmignore found",
        status: "warn",
      };
    },
    description: "files field or .npmignore exists",
    domain: DOMAIN.BUILD,
    files: ["package.json", ".npmignore"],
    id: "package-json:files-or-npmignore",
  }),
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts;
      const dangerousScripts = ["preinstall", "postinstall", "install"];
      const found: string[] = [];
      for (const name of dangerousScripts) {
        if (scripts?.[name]) {
          found.push(name);
        }
      }
      if (found.length > 0) {
        return {
          message: `install lifecycle scripts found: ${found.join(", ")} — these are the #1 supply chain attack vector in npm`,
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "no preinstall/postinstall/install lifecycle scripts",
    domain: DOMAIN.SECURITY,
    files: ["package.json"],
    id: "package-json:no-install-hooks",
  }),
];
