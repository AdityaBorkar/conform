import { RuleSet, Status } from "@/conform-api/index.ts";
import { fileExists, readFile } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";
import { hasHeading } from "./utils/markdown.ts";

const _docs = new RuleSet<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
}>({
  context: (targetPath) => ({
    fileExists: (path: string) => fileExists(targetPath, path),
    readFile: (path: string) => readFile(targetPath, path),
  }),
  domain: DOMAIN.DOCUMENTATION,
  id: "docs",
});

_docs.defineRule({
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

_docs.defineRule({
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

_docs.defineRule({
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

_docs.defineRule({
  id: "readme-install",
  name: "README has an Installation section",
  test({ context }) {
    const readme = context.readFile("README.md");
    if (!readme) {
      return Status.pass(
        "README.md not found — skipping install section check",
      );
    }
    if (
      hasHeading(readme, "install", "installation", "getting started", "setup")
    ) {
      return Status.pass();
    }
    return Status.warn(
      "README.md has no Installation section — add ## Install or ## Getting Started",
    );
  },
});

_docs.defineRule({
  id: "readme-usage",
  name: "README has a Usage section",
  test({ context }) {
    const readme = context.readFile("README.md");
    if (!readme) {
      return Status.pass("README.md not found — skipping usage section check");
    }
    if (hasHeading(readme, "usage", "quick start", "example", "basic usage")) {
      return Status.pass();
    }
    return Status.warn(
      "README.md has no Usage section — add ## Usage or ## Quick Start",
    );
  },
});

export const docs = _docs;
