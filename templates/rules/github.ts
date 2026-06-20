import { RuleSet, Status } from "@/conform-api/index.ts";
import { fileExists, readFile } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";
import {
  CI_WORKFLOW_CANDIDATES,
  findWorkflowFile,
  RELEASE_WORKFLOW_CANDIDATES,
} from "./utils/workflows.ts";

const _github = new RuleSet<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
  targetPath: string;
}>({
  context: (targetPath) => ({
    fileExists: (path: string) => fileExists(targetPath, path),
    readFile: (path: string) => readFile(targetPath, path),
    targetPath,
  }),
  domain: DOMAIN.GITHUB_CONFIG,
  id: "github",
});

_github.defineRule({
  id: "ci-workflow",
  name: "CI workflow file exists",
  test({ context }) {
    const ciFile = findWorkflowFile(context.targetPath, CI_WORKFLOW_CANDIDATES);
    if (ciFile) {
      return Status.pass(ciFile);
    }
    return Status.fail(
      "no CI workflow found — expected .github/workflows/{ci,test,build,check}.{yml,yaml}",
    );
  },
});

_github.defineRule({
  id: "release-workflow",
  name: "Release/publish workflow file exists",
  test({ context }) {
    const releaseFile = findWorkflowFile(
      context.targetPath,
      RELEASE_WORKFLOW_CANDIDATES,
    );
    if (releaseFile) {
      return Status.pass(releaseFile);
    }
    return Status.warn(
      "no release/publish workflow found — expected .github/workflows/{release,publish,deploy}.{yml,yaml}",
    );
  },
});

_github.defineRule({
  id: "ci-lint",
  name: "CI workflow runs lint",
  test({ context }) {
    const ciFile = findWorkflowFile(context.targetPath, CI_WORKFLOW_CANDIDATES);
    if (!ciFile) {
      return Status.pass("no CI workflow found — skipping content checks");
    }
    const content = context.readFile(ciFile);
    if (!content) {
      return Status.pass(
        "could not read CI workflow — skipping content checks",
      );
    }
    if (
      content.includes("biome") ||
      content.includes("lint") ||
      content.includes("check:lint")
    ) {
      return Status.pass();
    }
    return Status.warn(
      "CI workflow does not appear to run lint — add a lint step to catch style issues in CI",
    );
  },
});

_github.defineRule({
  id: "ci-typecheck",
  name: "CI workflow runs typecheck",
  test({ context }) {
    const ciFile = findWorkflowFile(context.targetPath, CI_WORKFLOW_CANDIDATES);
    if (!ciFile) {
      return Status.pass("no CI workflow found — skipping content checks");
    }
    const content = context.readFile(ciFile);
    if (!content) {
      return Status.pass(
        "could not read CI workflow — skipping content checks",
      );
    }
    if (
      content.includes("tsc") ||
      content.includes("typecheck") ||
      content.includes("check:types")
    ) {
      return Status.pass();
    }
    return Status.warn(
      "CI workflow does not appear to run typecheck — add a typecheck step to catch type errors in CI",
    );
  },
});

_github.defineRule({
  id: "dependabot",
  name: "Dependabot or Renovate config exists",
  test({ context }) {
    if (context.fileExists(".github/dependabot.yml")) {
      return Status.pass(".github/dependabot.yml");
    }
    if (context.fileExists(".github/dependabot.yaml")) {
      return Status.pass(".github/dependabot.yaml");
    }
    if (context.fileExists("renovate.json")) {
      return Status.pass("renovate.json");
    }
    if (context.fileExists(".renovaterc")) {
      return Status.pass(".renovaterc");
    }
    if (context.fileExists(".renovaterc.json")) {
      return Status.pass(".renovaterc.json");
    }
    return Status.warn(
      "no Dependabot or Renovate config found — automated dependency updates prevent security drift",
    );
  },
});

export const github = _github;
