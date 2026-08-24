import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { HuskyHookSpec } from "@/types.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const DEFAULT_HUSKY_HOOKS: readonly HuskyHookSpec[] = [
  { contains: "bun run format", file: ".husky/pre-commit" },
  { contains: 'bun commitlint --edit "$1"', file: ".husky/commit-msg" },
] as const;

export function resolveHuskyHooks(params?: {
  hooks: HuskyHookSpec[];
}): HuskyHookSpec[] {
  if (!params?.hooks || params.hooks.length === 0) {
    return [...DEFAULT_HUSKY_HOOKS];
  }
  return params.hooks;
}

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
    test({ context }) {
      if (context.fileExists(".husky")) {
        return Status.pass();
      }
      return Status.fail(".husky/ directory not found");
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "prepare-script",
    name: "prepare script calls husky",
    test({ context }) {
      const prepare = context.packageJson()?.scripts?.["prepare"];
      if (prepare?.includes("husky")) {
        return Status.pass(prepare);
      }
      if (!prepare) {
        return Status.fail("no prepare script found");
      }
      return Status.fail(`prepare is "${prepare}", expected to call husky`);
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: DEFAULT_HUSKY_HOOKS.map((h) => h.file),
    id: "hook",
    name: "husky hook file exists with expected content",
    params: type({
      hooks: type({ contains: "string", file: "string" }).array(),
    }),
    test({ context, params }) {
      const specs = resolveHuskyHooks(params);

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
