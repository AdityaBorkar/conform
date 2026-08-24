import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const docsFilesSchema = type({
  file_expressions: "string[]",
});

export const docs = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
  id: "docs",
})
  .defineRule({
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
  })
  .defineRule({
    domain: DOMAIN.DOCUMENTATION,
    id: "changelog",
    name: "CHANGELOG.md exists",
    params: docsFilesSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "CHANGELOG.md",
        "CHANGELOG",
        "HISTORY.md",
      ];
      const found = candidates.find((p) => context.fileExists(p));
      if (found) {
        return Status.pass(found);
      }
      return Status.warn(
        `no ${candidates.join(" or ")} found — users and consumers need to see what changed between versions`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.DOCUMENTATION,
    id: "contributing",
    name: "CONTRIBUTING.md exists",
    params: docsFilesSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "CONTRIBUTING.md",
        ".github/CONTRIBUTING.md",
      ];
      const found = candidates.find((p) => context.fileExists(p));
      if (found) {
        return Status.pass(found);
      }
      return Status.warn(
        `no ${candidates.join(" or ")} found — open source packages should tell contributors how to participate`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.SECURITY,
    id: "license",
    name: "LICENSE file exists",
    params: docsFilesSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "LICENSE",
        "LICENSE.md",
        "LICENSE.txt",
      ];
      const found = candidates.find((p) => context.fileExists(p));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`no ${candidates.join(" or ")} found`);
    },
  })
  .defineRule({
    domain: DOMAIN.SECURITY,
    id: "security-md",
    name: "SECURITY.md exists",
    params: docsFilesSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "SECURITY.md",
        ".github/SECURITY.md",
      ];
      const found = candidates.find((p) => context.fileExists(p));
      if (found) {
        return Status.pass(found);
      }
      return Status.warn(
        `no ${candidates.join(" or ")} found — provides a responsible disclosure path for vulnerability reports`,
      );
    },
  });
