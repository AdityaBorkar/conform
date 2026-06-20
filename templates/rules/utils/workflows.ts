import type { CheckContext } from "@/types.ts";

export const CI_WORKFLOW_CANDIDATES = [
  ".github/workflows/ci.yml",
  ".github/workflows/ci.yaml",
  ".github/workflows/test.yml",
  ".github/workflows/test.yaml",
  ".github/workflows/build.yml",
  ".github/workflows/build.yaml",
  ".github/workflows/check.yml",
  ".github/workflows/check.yaml",
];

export const RELEASE_WORKFLOW_CANDIDATES = [
  ".github/workflows/release.yml",
  ".github/workflows/release.yaml",
  ".github/workflows/publish.yml",
  ".github/workflows/publish.yaml",
  ".github/workflows/deploy.yml",
  ".github/workflows/deploy.yaml",
];

export function findWorkflowFile(
  ctx: CheckContext,
  candidates: string[],
): string | null {
  for (const path of candidates) {
    if (ctx.readFile(path) !== null) {
      return path;
    }
  }
  return null;
}
