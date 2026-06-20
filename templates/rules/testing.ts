import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";
import { packageJson } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";

const _testing = new RuleSet<{
  packageJson: () => PackageJson | null;
}>({
  context: (targetPath) => ({
    packageJson: () => packageJson(targetPath),
  }),
  domain: DOMAIN.TESTING,
  id: "testing",
});

_testing.defineRule({
  id: "test-script",
  name: "scripts.test exists in package.json",
  test({ context }) {
    const testScript = context.packageJson()?.scripts?.["test"];
    if (testScript) {
      return Status.pass(testScript);
    }
    return Status.fail(
      'no test script found — add "test" to scripts (e.g. "bun test" or "vitest")',
    );
  },
});

_testing.defineRule({
  id: "test-runner",
  name: "test script invokes a known test runner",
  test({ context }) {
    const testScript = context.packageJson()?.scripts?.["test"];
    if (!testScript) {
      return Status.pass("no test script — skipping runner check");
    }
    const isNoOp =
      testScript.includes("echo") || testScript.trim() === "exit 0";
    if (isNoOp) {
      return Status.warn(
        `test script appears to be a placeholder: "${testScript}"`,
      );
    }
    const knownRunners =
      /bun\s+test|vitest|jest|mocha|ava|tape|uvu|node\s+--test/;
    if (knownRunners.test(testScript)) {
      return Status.pass();
    }
    return Status.warn(
      `test script "${testScript}" does not reference a known test runner`,
    );
  },
});

export const testing = _testing;
