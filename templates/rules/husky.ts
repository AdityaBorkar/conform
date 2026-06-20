import { RuleSet, Status } from "@/conform-api/index.ts";

import { DOMAIN } from "./utils/domain.ts";

export const husky = new RuleSet({
  context: (target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "husky",
});

husky.defineRule({
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

husky.defineRule({
  id: "hooks-dir",
  name: ".husky/ directory exists",
  test({ context }) {
    if (context.fileExists(".husky")) {
      return Status.pass();
    }
    return Status.fail(".husky/ directory not found");
  },
});

husky.defineRule({
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

husky.defineRule({
  id: "pre-commit",
  name: "pre-commit hook exists",
  test({ context }) {
    if (context.fileExists(".husky/pre-commit")) {
      return Status.pass();
    }
    return Status.fail("no pre-commit hook found");
  },
});

husky.defineRule({
  id: "commit-msg",
  name: "commit-msg hook exists",
  test({ context }) {
    if (context.fileExists(".husky/commit-msg")) {
      return Status.pass();
    }
    return Status.fail("no commit-msg hook found");
  },
});
