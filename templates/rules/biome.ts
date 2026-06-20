import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { STYLE } from "./utils/domains.ts";

export const biomeRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const version = ctx.packageJson()?.devDependencies?.["@biomejs/biome"];
      if (version) {
        return { message: version, status: "pass" };
      }
      return {
        message: "@biomejs/biome not found in devDependencies",
        status: "fail",
      };
    },
    description: "@biomejs/biome in devDependencies",
    domain: STYLE,
    files: ["package.json"],
    id: "biome:dev-deps",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists("biome.json")) {
        return { message: "biome.json", status: "pass" };
      }
      if (ctx.fileExists("biome.jsonc")) {
        return { message: "biome.jsonc", status: "pass" };
      }
      return {
        message: "no biome.json or biome.jsonc found",
        status: "warn",
      };
    },
    description: "biome.json or biome.jsonc exists",
    domain: STYLE,
    files: ["biome.json", "biome.jsonc"],
    id: "biome:config-file",
  }),
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts ?? {};
      const lintScript = scripts["lint"] ?? scripts["check"];
      if (lintScript?.includes("biome")) {
        return { message: lintScript, status: "pass" };
      }
      return {
        message: "no script running biome check/lint found",
        status: "fail",
      };
    },
    description: "lint or check script runs biome",
    domain: STYLE,
    files: ["package.json"],
    id: "biome:lint-script",
  }),
  defineRule({
    check: (ctx) => {
      const scripts = ctx.packageJson()?.scripts ?? {};
      const formatScript =
        scripts["format"] ?? scripts["check:format"] ?? scripts["check:lint"];
      if (formatScript?.includes("biome")) {
        return { message: formatScript, status: "pass" };
      }
      return {
        message:
          "no format script running biome format found — add a format script to enforce consistent style",
        status: "warn",
      };
    },
    description: "format script runs biome",
    domain: STYLE,
    files: ["package.json"],
    id: "biome:format-script",
  }),
];
