import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { GITHUB } from "./utils/domains.ts";
import {
  CI_WORKFLOW_CANDIDATES,
  findWorkflowFile,
  RELEASE_WORKFLOW_CANDIDATES,
} from "./utils/workflows.ts";

export const githubRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
      if (ciFile) {
        return { message: ciFile, status: "pass" };
      }
      return {
        message:
          "no CI workflow found — expected .github/workflows/{ci,test,build,check}.{yml,yaml}",
        status: "fail",
      };
    },
    description: "CI workflow file exists",
    domain: GITHUB,
    files: [".github/workflows/"],
    id: "github:ci-workflow",
  }),
  defineRule({
    check: (ctx) => {
      const releaseFile = findWorkflowFile(ctx, RELEASE_WORKFLOW_CANDIDATES);
      if (releaseFile) {
        return { message: releaseFile, status: "pass" };
      }
      return {
        message:
          "no release/publish workflow found — expected .github/workflows/{release,publish,deploy}.{yml,yaml}",
        status: "warn",
      };
    },
    description: "Release/publish workflow file exists",
    domain: GITHUB,
    files: [".github/workflows/"],
    id: "github:release-workflow",
  }),
  defineRule({
    check: (ctx) => {
      const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
      if (!ciFile) {
        return {
          message: "no CI workflow found — skipping content checks",
          status: "pass",
        };
      }
      const content = ctx.readFile(ciFile);
      if (!content) {
        return {
          message: "could not read CI workflow — skipping content checks",
          status: "pass",
        };
      }
      if (
        content.includes("biome") ||
        content.includes("lint") ||
        content.includes("check:lint")
      ) {
        return { status: "pass" };
      }
      return {
        message:
          "CI workflow does not appear to run lint — add a lint step to catch style issues in CI",
        status: "warn",
      };
    },
    description: "CI workflow runs lint",
    domain: GITHUB,
    files: [".github/workflows/"],
    id: "github:ci-lint",
  }),
  defineRule({
    check: (ctx) => {
      const ciFile = findWorkflowFile(ctx, CI_WORKFLOW_CANDIDATES);
      if (!ciFile) {
        return {
          message: "no CI workflow found — skipping content checks",
          status: "pass",
        };
      }
      const content = ctx.readFile(ciFile);
      if (!content) {
        return {
          message: "could not read CI workflow — skipping content checks",
          status: "pass",
        };
      }
      if (
        content.includes("tsc") ||
        content.includes("typecheck") ||
        content.includes("check:types")
      ) {
        return { status: "pass" };
      }
      return {
        message:
          "CI workflow does not appear to run typecheck — add a typecheck step to catch type errors in CI",
        status: "warn",
      };
    },
    description: "CI workflow runs typecheck",
    domain: GITHUB,
    files: [".github/workflows/"],
    id: "github:ci-typecheck",
  }),
  defineRule({
    check: (ctx) => {
      if (ctx.fileExists(".github/dependabot.yml")) {
        return { message: ".github/dependabot.yml", status: "pass" };
      }
      if (ctx.fileExists(".github/dependabot.yaml")) {
        return { message: ".github/dependabot.yaml", status: "pass" };
      }
      if (ctx.fileExists("renovate.json")) {
        return { message: "renovate.json", status: "pass" };
      }
      if (ctx.fileExists(".renovaterc")) {
        return { message: ".renovaterc", status: "pass" };
      }
      if (ctx.fileExists(".renovaterc.json")) {
        return { message: ".renovaterc.json", status: "pass" };
      }
      return {
        message:
          "no Dependabot or Renovate config found — automated dependency updates prevent security drift",
        status: "warn",
      };
    },
    description: "Dependabot or Renovate config exists",
    domain: GITHUB,
    files: [
      ".github/dependabot.yml",
      ".github/dependabot.yaml",
      "renovate.json",
      ".renovaterc",
      ".renovaterc.json",
    ],
    id: "github:dependabot",
  }),
];
