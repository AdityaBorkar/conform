import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

export const tsconfigRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const version =
        ctx.packageJson()?.devDependencies?.typescript ??
        ctx.packageJson()?.peerDependencies?.typescript;
      if (version) {
        return { message: version, status: "pass" };
      }
      return {
        message: "typescript not found in devDependencies or peerDependencies",
        status: "fail",
      };
    },
    description: "typescript in devDependencies or peerDependencies",
    domain: DOMAIN.CODE_QUALITY,
    files: ["package.json"],
    id: "typescript:deps",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists("tsconfig.json")) {
        return { status: "pass" };
      }
      return { message: "tsconfig.json not found", status: "fail" };
    },
    description: "tsconfig.json exists",
    domain: DOMAIN.CODE_QUALITY,
    files: ["tsconfig.json"],
    id: "typescript:tsconfig",
  }),
  defineRule({
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
    domain: DOMAIN.CODE_QUALITY,
    files: ["tsconfig.json"],
    id: "typescript:strict",
  }),
  defineRule({
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
    domain: DOMAIN.CODE_QUALITY,
    files: ["tsconfig.json"],
    id: "typescript:no-unchecked-indexed-access",
  }),
  defineRule({
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
    domain: DOMAIN.CODE_QUALITY,
    files: ["tsconfig.json"],
    id: "typescript:isolated-modules",
  }),
  defineRule({
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
    domain: DOMAIN.CODE_QUALITY,
    files: ["tsconfig.json"],
    id: "typescript:verbatim-module-syntax",
  }),
  defineRule({
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
    domain: DOMAIN.OBSERVABILITY,
    files: ["tsconfig.json"],
    id: "typescript:source-map",
  }),
];
