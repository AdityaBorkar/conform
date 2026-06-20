import type { Rule } from "@/types.ts";

import { codeQuality, observability } from "./domains.ts";

export const tsconfigRules: Rule[] = [
  codeQuality.rule({
    check: (ctx) => {
      const version =
        ctx.packageJson?.devDependencies?.["typescript"] ??
        ctx.packageJson?.peerDependencies?.["typescript"];
      if (version) {
        return { message: version, status: "pass" };
      }
      return {
        message: "typescript not found in devDependencies or peerDependencies",
        status: "fail",
      };
    },
    description: "typescript in devDependencies or peerDependencies",
    files: ["package.json"],
    id: "typescript:deps",
  }),
  codeQuality.rule({
    check: (ctx) => {
      if (ctx.fileExists("tsconfig.json")) {
        return { status: "pass" };
      }
      return { message: "tsconfig.json not found", status: "fail" };
    },
    description: "tsconfig.json exists",
    files: ["tsconfig.json"],
    id: "typescript:tsconfig",
  }),
  codeQuality.rule({
    check: (ctx) => {
      const tsconfig = ctx.readJson<{
        compilerOptions?: { strict?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.strict === true) {
        return { status: "pass" };
      }
      return {
        message: "strict mode not enabled in tsconfig.json",
        status: "fail",
      };
    },
    description: "strict: true in tsconfig",
    files: ["tsconfig.json"],
    id: "typescript:strict",
  }),
  codeQuality.rule({
    check: (ctx) => {
      const tsconfig = ctx.readJson<{
        compilerOptions?: { noUncheckedIndexedAccess?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.noUncheckedIndexedAccess === true) {
        return { status: "pass" };
      }
      return {
        message:
          "noUncheckedIndexedAccess is not enabled — array/object index access should return T | undefined to catch runtime errors",
        status: "fail",
      };
    },
    description: "noUncheckedIndexedAccess: true in tsconfig",
    files: ["tsconfig.json"],
    id: "typescript:no-unchecked-indexed-access",
  }),
  codeQuality.rule({
    check: (ctx) => {
      const tsconfig = ctx.readJson<{
        compilerOptions?: { isolatedModules?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.isolatedModules === true) {
        return { status: "pass" };
      }
      return {
        message:
          "isolatedModules is not enabled — required for Bun, esbuild, and SWC which transpile files individually",
        status: "fail",
      };
    },
    description: "isolatedModules: true in tsconfig",
    files: ["tsconfig.json"],
    id: "typescript:isolated-modules",
  }),
  codeQuality.rule({
    check: (ctx) => {
      const tsconfig = ctx.readJson<{
        compilerOptions?: { verbatimModuleSyntax?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.verbatimModuleSyntax === true) {
        return { status: "pass" };
      }
      return {
        message:
          "verbatimModuleSyntax is not enabled — prevents CJS/ESM mismatches by preserving import/export syntax exactly",
        status: "warn",
      };
    },
    description: "verbatimModuleSyntax: true in tsconfig",
    files: ["tsconfig.json"],
    id: "typescript:verbatim-module-syntax",
  }),
  observability.rule({
    check: (ctx) => {
      const tsconfig = ctx.readJson<{
        compilerOptions?: {
          noEmit?: boolean;
          sourceMap?: boolean;
        };
      }>("tsconfig.json");
      if (!tsconfig?.compilerOptions) {
        return {
          message: "no tsconfig.json found — skipping source map check",
          status: "pass",
        };
      }
      if (tsconfig.compilerOptions.noEmit === true) {
        return {
          message:
            "noEmit is true — source maps not applicable for raw TS publishing",
          status: "pass",
        };
      }
      if (tsconfig.compilerOptions.sourceMap === true) {
        return { status: "pass" };
      }
      return {
        message:
          "sourceMap is not enabled — without source maps, production stack traces point to compiled output and are nearly impossible to debug",
        status: "warn",
      };
    },
    description: "sourceMap: true in tsconfig (when not noEmit)",
    files: ["tsconfig.json"],
    id: "typescript:source-map",
  }),
];
