import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

const _scripts = new RuleSet<{
  packageJson: () => PackageJson | null;
}>({
  context: (target) => ({
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.BUILD,
  id: "scripts",
});

_scripts.defineRule({
  id: "typecheck",
  name: "typecheck script exists",
  test({ context }) {
    const scripts = context.packageJson()?.scripts ?? {};
    const typecheckScript =
      scripts["typecheck"] ?? scripts["check:types"] ?? scripts["types"];
    if (typecheckScript) {
      return Status.pass(typecheckScript);
    }
    return Status.warn(
      "no typecheck script found — add a typecheck or check:types script running tsc --noEmit",
    );
  },
});

_scripts.defineRule({
  id: "no-prepublish",
  name: "deprecated prepublish script is not used",
  test({ context }) {
    const scripts = context.packageJson()?.scripts;
    if (scripts?.["prepublish"]) {
      return Status.fail(
        'prepublish script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.',
      );
    }
    return Status.pass();
  },
});

export const scripts = _scripts;
