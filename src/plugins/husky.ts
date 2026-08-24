import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const husky = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
    readFile: (path: string) => target.readFile(path),
  }),
  id: "husky",
})
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "dev-deps",
    name: "husky in devDependencies",
    test({ context }) {
      const huskyVersion = context.packageJson()?.devDependencies?.["husky"];
      if (huskyVersion) {
        return Status.pass(huskyVersion);
      }
      return Status.fail("husky not found in devDependencies");
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "hooks-dir",
    name: ".husky/ directory exists",
    params: type({
      file_expressions: "string[]",
    }),
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [".husky"];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`${candidates.join(" or ")} not found`);
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "prepare-script",
    name: "prepare script calls husky",
    params: type({
      contains: "string",
      file_expressions: "string[]",
    }),
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.file_expressions ?? ["prepare"];
      const contains = params?.contains ?? "husky";
      const scriptName = candidates.find((s) => scripts[s]);
      if (!scriptName) {
        return Status.fail(`no ${candidates.join(" or ")} script found`);
      }
      const content = scripts[scriptName] as string;
      if (content.includes(contains)) {
        return Status.pass(content);
      }
      return Status.fail(
        `${scriptName} is "${content}", expected to contain "${contains}"`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".husky/pre-commit", ".husky/commit-msg"],
    id: "hook",
    name: "husky hook file exists with expected content",
    params: type({
      hooks: type({ contains: "string", file: "string" }).array(),
    }),
    test({ context, params }) {
      const specs = params?.hooks ?? [];

      const failures: string[] = [];
      for (const { file, contains } of specs) {
        if (!context.fileExists(file)) {
          failures.push(`${file} not found`);
          continue;
        }
        const content = context.readFile(file);
        if (!content) {
          failures.push(`${file} is empty or unreadable`);
          continue;
        }
        if (!content.includes(contains)) {
          failures.push(`${file} does not contain "${contains}"`);
        }
      }

      if (failures.length === 0) {
        const summary = specs
          .map((s) => `${s.file}: contains "${s.contains}"`)
          .join(", ");
        return Status.pass(summary);
      }

      return Status.fail(failures.join("; "));
    },
  });
