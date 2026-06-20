import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";
import { fileExists, packageJson, readFile } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";
import { getExportPaths, resolveJsrConfig } from "./utils/jsr.ts";
import { SLOW_TYPE_PATTERNS } from "./utils/slow_types.ts";

const _jsr = new RuleSet<{
  packageJson: () => PackageJson | null;
  readFile: (path: string) => string | null;
  targetPath: string;
}>({
  context: (targetPath) => ({
    packageJson: () => packageJson(targetPath),
    readFile: (path: string) => readFile(targetPath, path),
    targetPath,
  }),
  id: "jsr",
});

_jsr.defineRule({
  domain: DOMAIN.DOCUMENTATION,
  id: "has-description",
  name: "package has a description for discoverability (JSR: has_description — 1pt)",
  test({ context }) {
    const config = resolveJsrConfig(context.targetPath);
    const description =
      config.jsr?.description ?? context.packageJson()?.description;
    if (typeof description === "string" && description.trim().length > 0) {
      return Status.pass(
        `description found in ${config.jsr ? config.source : "package.json"}`,
      );
    }
    return Status.fail(
      `no description found in ${config.source} or package.json — JSR requires a description for discoverability`,
    );
  },
});

_jsr.defineRule({
  domain: DOMAIN.CODE_QUALITY,
  id: "no-slow-types",
  name: "no slow types in exported symbols (JSR: all_fast_check — 5pts)",
  test({ context }) {
    const exportPaths = getExportPaths(context.targetPath);
    if (exportPaths.length === 0) {
      return Status.pass("no exports defined — skipping slow types check");
    }
    const violations: string[] = [];
    for (const expPath of exportPaths) {
      const content = context.readFile(expPath);
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
      return Status.pass("no slow types detected");
    }
    return Status.fail(
      `slow types detected:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
  },
});

_jsr.defineRule({
  domain: DOMAIN.SECURITY,
  id: "provenance",
  name: "publish workflow uses jsr publish with provenance (JSR: has_provenance — 1pt)",
  test({ context }) {
    const ghDir = fileExists(context.targetPath, ".github");
    if (!ghDir) {
      return Status.warn(
        "no .github directory found — cannot check provenance",
      );
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
      const content = context.readFile(wf);
      if (content === null) {
        continue;
      }
      if (content.includes("jsr publish") || content.includes("deno publish")) {
        if (content.includes("--no-provenance")) {
          found.push(`${wf} (has --no-provenance — provenance disabled)`);
        } else {
          found.push(wf);
        }
      }
    }
    if (found.length === 0) {
      return Status.warn(
        "no GitHub Actions workflow found that runs jsr publish or deno publish — provenance requires publishing from GitHub Actions",
      );
    }
    const hasDisabled = found.some((f) => f.includes("--no-provenance"));
    if (hasDisabled) {
      return Status.warn(
        `found publish workflows but provenance may be disabled:\n${found.map((f) => `  - ${f}`).join("\n")}`,
      );
    }
    return Status.pass(
      `found publish workflow with provenance: ${found.join(", ")}`,
    );
  },
});

export const jsr = _jsr;
