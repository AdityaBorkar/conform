import type { Rule } from "@/types.ts";

import { documentation } from "./domains.ts";
import { hasHeading } from "./utils/markdown.ts";

export const docsRules: Rule[] = [
  documentation.rule({
    check: (ctx) => {
      const content = ctx.readFile("README.md");
      if (content === null) {
        return { message: "README.md not found", status: "fail" };
      }
      if (content.trim().length === 0) {
        return { message: "README.md is empty", status: "fail" };
      }
      return { status: "pass" };
    },
    description: "README.md exists and is non-empty (JSR: has_readme — 2pts)",
    files: ["README.md"],
    id: "files:readme",
  }),
  documentation.rule({
    check: (ctx) => {
      const changelogPaths = ["CHANGELOG.md", "CHANGELOG", "HISTORY.md"];
      for (const path of changelogPaths) {
        if (ctx.fileExists(path)) {
          return { message: path, status: "pass" };
        }
      }
      return {
        message:
          "no CHANGELOG.md found — users and consumers need to see what changed between versions",
        status: "warn",
      };
    },
    description: "CHANGELOG.md exists",
    files: ["CHANGELOG.md", "CHANGELOG", "HISTORY.md"],
    id: "docs:changelog",
  }),
  documentation.rule({
    check: (ctx) => {
      if (ctx.fileExists("CONTRIBUTING.md")) {
        return { status: "pass" };
      }
      if (ctx.fileExists(".github/CONTRIBUTING.md")) {
        return { message: ".github/CONTRIBUTING.md", status: "pass" };
      }
      return {
        message:
          "no CONTRIBUTING.md found — open source packages should tell contributors how to participate",
        status: "warn",
      };
    },
    description: "CONTRIBUTING.md exists",
    files: ["CONTRIBUTING.md", ".github/CONTRIBUTING.md"],
    id: "docs:contributing",
  }),
  documentation.rule({
    check: (ctx) => {
      const readme = ctx.readFile("README.md");
      if (!readme) {
        return {
          message: "README.md not found — skipping install section check",
          status: "pass",
        };
      }
      if (
        hasHeading(
          readme,
          "install",
          "installation",
          "getting started",
          "setup",
        )
      ) {
        return { status: "pass" };
      }
      return {
        message:
          "README.md has no Installation section — add ## Install or ## Getting Started",
        status: "warn",
      };
    },
    description: "README has an Installation section",
    files: ["README.md"],
    id: "docs:readme-install",
  }),
  documentation.rule({
    check: (ctx) => {
      const readme = ctx.readFile("README.md");
      if (!readme) {
        return {
          message: "README.md not found — skipping usage section check",
          status: "pass",
        };
      }
      if (
        hasHeading(readme, "usage", "quick start", "example", "basic usage")
      ) {
        return { status: "pass" };
      }
      return {
        message:
          "README.md has no Usage section — add ## Usage or ## Quick Start",
        status: "warn",
      };
    },
    description: "README has a Usage section",
    files: ["README.md"],
    id: "docs:readme-usage",
  }),
];
