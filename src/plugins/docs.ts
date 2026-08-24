import { RuleSet, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const docs = new RuleSet<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
}>({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
  domain: DOMAIN.DOCUMENTATION,
  id: "docs",
});

docs.defineRule({
  domain: DOMAIN.DOCUMENTATION,
  id: "readme",
  name: "README.md exists and is non-empty (JSR: has_readme — 2pts)",
  test({ context }) {
    const content = context.readFile("README.md");
    if (content === null) {
      return Status.fail("README.md not found");
    }
    if (content.trim().length === 0) {
      return Status.fail("README.md is empty");
    }
    return Status.pass();
  },
});

docs.defineRule({
  domain: DOMAIN.DOCUMENTATION,
  id: "changelog",
  name: "CHANGELOG.md exists",
  test({ context }) {
    const changelogPaths = ["CHANGELOG.md", "CHANGELOG", "HISTORY.md"];
    for (const path of changelogPaths) {
      if (context.fileExists(path)) {
        return Status.pass(path);
      }
    }
    return Status.warn(
      "no CHANGELOG.md found — users and consumers need to see what changed between versions",
    );
  },
});

docs.defineRule({
  domain: DOMAIN.DOCUMENTATION,
  id: "contributing",
  name: "CONTRIBUTING.md exists",
  test({ context }) {
    if (context.fileExists("CONTRIBUTING.md")) {
      return Status.pass();
    }
    if (context.fileExists(".github/CONTRIBUTING.md")) {
      return Status.pass(".github/CONTRIBUTING.md");
    }
    return Status.warn(
      "no CONTRIBUTING.md found — open source packages should tell contributors how to participate",
    );
  },
});

docs.defineRule({
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

docs.defineRule({
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
