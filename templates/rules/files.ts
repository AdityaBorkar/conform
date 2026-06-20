import { RuleSet, Status } from "@/conform-api/index.ts";

import { DOMAIN } from "./utils/domain.ts";

const _files = new RuleSet<{
  fileExists: (path: string) => boolean;
}>({
  context: (target) => ({
    fileExists: (path: string) => target.fileExists(path),
  }),
  id: "files",
});

_files.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "lockfile",
  name: "lockfile exists (bun.lock, package-lock.json, etc.)",
  test({ context }) {
    const lockfiles = [
      "bun.lock",
      "bun.lockb",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ];
    for (const lf of lockfiles) {
      if (context.fileExists(lf)) {
        return Status.pass(lf);
      }
    }
    return Status.fail(
      "no lockfile found — committed lockfiles ensure reproducible installs across environments",
    );
  },
});

_files.defineRule({
  domain: DOMAIN.SECURITY,
  id: "license",
  name: "LICENSE file exists",
  test({ context }) {
    if (
      context.fileExists("LICENSE") ||
      context.fileExists("LICENSE.md") ||
      context.fileExists("LICENSE.txt")
    ) {
      return Status.pass();
    }
    return Status.fail("no LICENSE file found");
  },
});

_files.defineRule({
  domain: DOMAIN.SECURITY,
  id: "security-md",
  name: "SECURITY.md exists",
  test({ context }) {
    if (context.fileExists("SECURITY.md")) {
      return Status.pass();
    }
    if (context.fileExists(".github/SECURITY.md")) {
      return Status.pass(".github/SECURITY.md");
    }
    return Status.warn(
      "no SECURITY.md found — provides a responsible disclosure path for vulnerability reports",
    );
  },
});

export const files = _files;
