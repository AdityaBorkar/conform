import { describe, expect, it } from "vitest";

import { runChecks } from "@/engine/index.ts";
import type { CheckContext, Rule, Template } from "@/types.ts";

function mockContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    fileExists: () => false,
    packageJson: null,
    readFile: () => null,
    readJson: () => null,
    targetPath: "/tmp/mock",
    ...overrides,
  };
}

function makeRule(
  id: string,
  status: "pass" | "warn" | "fail",
  message?: string,
): Rule {
  return {
    check: () => ({ status, ...(message ? { message } : {}) }),
    description: `Rule ${id}`,
    domain: "test",
    files: ["package.json"],
    id,
  };
}

describe("runChecks", () => {
  it("returns results for all rules", async () => {
    const template: Template = {
      description: "A test template",
      name: "test-template",
      rules: [
        makeRule("a:1", "pass"),
        makeRule("a:2", "warn"),
        makeRule("a:3", "fail"),
      ],
    };
    const ctx = mockContext();
    const results = await runChecks(template, ctx);
    expect(results).toHaveLength(3);
    expect(results[0]?.status).toBe("pass");
    expect(results[1]?.status).toBe("warn");
    expect(results[2]?.status).toBe("fail");
  });

  it("propagates rule metadata", async () => {
    const template: Template = {
      description: "Metadata test",
      name: "meta-template",
      rules: [makeRule("group:id", "fail", "something broke")],
    };
    const ctx = mockContext();
    const results = await runChecks(template, ctx);
    const result = results[0];
    expect(result?.id).toBe("group:id");
    expect(result?.domain).toBe("test");
    expect(result?.files).toEqual(["package.json"]);
    expect(result?.description).toBe("Rule group:id");
    expect(result?.message).toBe("something broke");
  });

  it("omits message when undefined", async () => {
    const template: Template = {
      description: "No message",
      name: "no-msg",
      rules: [makeRule("x:y", "pass")],
    };
    const ctx = mockContext();
    const results = await runChecks(template, ctx);
    expect(results[0]?.message).toBeUndefined();
  });

  it("handles async check functions", async () => {
    const template: Template = {
      description: "Async test",
      name: "async-template",
      rules: [
        {
          check: async () => {
            await Promise.resolve();
            return { status: "pass" as const };
          },
          description: "Async rule",
          domain: "test",
          files: ["package.json"],
          id: "async:check",
        },
      ],
    };
    const ctx = mockContext();
    const results = await runChecks(template, ctx);
    expect(results[0]?.status).toBe("pass");
  });

  it("returns empty array for template with no rules", async () => {
    const template: Template = {
      description: "No rules",
      name: "empty",
      rules: [],
    };
    const ctx = mockContext();
    const results = await runChecks(template, ctx);
    expect(results).toHaveLength(0);
  });
});
