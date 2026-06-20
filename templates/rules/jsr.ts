import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";
import { getExportPaths, resolveJsrConfig } from "./utils/jsr.ts";
import { SLOW_TYPE_PATTERNS } from "./utils/slow_types.ts";

export const jsrRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const config = resolveJsrConfig(ctx);
      const description =
        config.jsr?.description ?? ctx.packageJson()?.description;
      if (description && description.trim().length > 0) {
        return {
          message: `description found in ${config.jsr ? config.source : "package.json"}`,
          status: "pass",
        };
      }
      return {
        message: `no description found in ${config.source} or package.json — JSR requires a description for discoverability`,
        status: "fail",
      };
    },
    description:
      "package has a description for discoverability (JSR: has_description — 1pt)",
    domain: DOMAIN.DOCUMENTATION,
    files: ["jsr.json", "deno.json", "package.json"],
    id: "jsr:has-description",
  }),
  defineRule({
    check: (ctx) => {
      const exportPaths = getExportPaths(ctx);
      if (exportPaths.length === 0) {
        return {
          message: "no exports defined — skipping slow types check",
          status: "pass",
        };
      }
      const violations: string[] = [];
      for (const expPath of exportPaths) {
        const content = ctx.readFile(expPath);
        if (content === null) {
          continue;
        }
        for (const { pattern, message } of SLOW_TYPE_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${expPath}: ${message}`);
          }
        }
      }
      if (violations.length === 0) {
        return { message: "no slow types detected", status: "pass" };
      }
      return {
        message: `slow types detected:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
        status: "fail",
      };
    },
    description:
      "no slow types in exported symbols (JSR: all_fast_check — 5pts)",
    domain: DOMAIN.CODE_QUALITY,
    files: ["jsr.json", "deno.json"],
    id: "jsr:no-slow-types",
  }),
  defineRule({
    check: (ctx) => {
      const ghDir = ctx.fileExists(".github");
      if (!ghDir) {
        return {
          message: "no .github directory found — cannot check provenance",
          status: "warn",
        };
      }
      const workflowFiles = [
        ".github/workflows/publish.yml",
        ".github/workflows/publish.yaml",
        ".github/workflows/release.yml",
        ".github/workflows/release.yaml",
        ".github/workflows/ci.yml",
        ".github/workflows/ci.yaml",
      ];
      const found: string[] = [];
      for (const wf of workflowFiles) {
        const content = ctx.readFile(wf);
        if (content === null) {
          continue;
        }
        if (
          content.includes("jsr publish") ||
          content.includes("deno publish")
        ) {
          if (content.includes("--no-provenance")) {
            found.push(`${wf} (has --no-provenance — provenance disabled)`);
          } else {
            found.push(wf);
          }
        }
      }
      if (found.length === 0) {
        return {
          message:
            "no GitHub Actions workflow found that runs jsr publish or deno publish — provenance requires publishing from GitHub Actions",
          status: "warn",
        };
      }
      const hasDisabled = found.some((f) => f.includes("--no-provenance"));
      if (hasDisabled) {
        return {
          message: `found publish workflows but provenance may be disabled:\n${found.map((f) => `  - ${f}`).join("\n")}`,
          status: "warn",
        };
      }
      return {
        message: `found publish workflow with provenance: ${found.join(", ")}`,
        status: "pass",
      };
    },
    description:
      "publish workflow uses jsr publish with provenance (JSR: has_provenance — 1pt)",
    domain: DOMAIN.SECURITY,
    files: [".github/workflows/"],
    id: "jsr:provenance",
  }),
];
