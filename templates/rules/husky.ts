import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

const _husky = new RuleSet<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
}>({
  context: (target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "husky",
});

_husky.defineRule({
  id: "dev-deps",
  name: "husky in devDependencies",
  test({ context }) {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    const huskyVersion = context.packageJson()?.devDependencies?.["husky"];
    if (huskyVersion) {
      return Status.pass(huskyVersion);
    }
    return Status.fail("husky not found in devDependencies");
  },
});

_husky.defineRule({
  id: "hooks-dir",
  name: ".husky/ directory exists",
  test({ context }) {
    if (context.fileExists(".husky")) {
      return Status.pass();
    }
    return Status.fail(".husky/ directory not found");
  },
});

_husky.defineRule({
  id: "prepare-script",
  name: "prepare script calls husky",
  test({ context }) {
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    const prepare = context.packageJson()?.scripts?.["prepare"];
    if (prepare?.includes("husky")) {
      return Status.pass(prepare);
    }
    if (!prepare) {
      return Status.fail("no prepare script found");
    }
    return Status.fail(`prepare is "${prepare}", expected to call husky`);
  },
});

_husky.defineRule({
  id: "pre-commit",
  name: "pre-commit hook exists",
  test({ context }) {
    if (context.fileExists(".husky/pre-commit")) {
      return Status.pass();
    }
    return Status.fail("no pre-commit hook found");
  },
});

_husky.defineRule({
  id: "commit-msg",
  name: "commit-msg hook exists",
  test({ context }) {
    if (context.fileExists(".husky/commit-msg")) {
      return Status.pass();
    }
    return Status.fail("no commit-msg hook found");
  },
});

export const husky = _husky;
