import { defineRule } from "@/conform-api/index.ts";
import type { Rule } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

export const testingRules: Rule[] = [
  defineRule({
    check: (ctx) => {
      const testScript = ctx.packageJson()?.scripts?.test;
      if (testScript) {
        return { message: testScript, status: "pass" };
      }
      return {
        message:
          'no test script found — add "test" to scripts (e.g. "bun test" or "vitest")',
        status: "fail",
      };
    },
    description: "scripts.test exists in package.json",
    domain: DOMAIN.TESTING,
    files: ["package.json"],
    id: "testing:test-script",
  }),
  defineRule({
    check: (ctx) => {
      const testScript = ctx.packageJson()?.scripts?.test;
      if (!testScript) {
        return {
          message: "no test script — skipping runner check",
          status: "pass",
        };
      }
      const isNoOp =
        testScript.includes("echo") || testScript.trim() === "exit 0";
      if (isNoOp) {
        return {
          message: `test script appears to be a placeholder: "${testScript}"`,
          status: "warn",
        };
      }
      const knownRunners =
        /bun\s+test|vitest|jest|mocha|ava|tape|uvu|node\s+--test/;
      if (knownRunners.test(testScript)) {
        return { status: "pass" };
      }
      return {
        message: `test script "${testScript}" does not reference a known test runner`,
        status: "warn",
      };
    },
    description: "test script invokes a known test runner",
    domain: DOMAIN.TESTING,
    files: ["package.json"],
    id: "testing:test-runner",
  }),
];
