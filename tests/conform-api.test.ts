import { describe, expect, it } from "vitest";

import {
  defineConfig,
  defineRule,
  defineTemplate,
} from "@/conform-api/index.ts";
import type { ConformConfig, Target, Template } from "@/types.ts";

const mockTarget: Target = {
  fileExists: () => false,
  packageJson: () => null,
  readFile: () => null,
  readJson: () => null,
  targetPath: "/tmp",
};

describe("defineConfig", () => {
  it("returns the config as-is", () => {
    const config: ConformConfig = { template: "npm-pkg" };
    expect(defineConfig(config)).toEqual(config);
  });
});

describe("defineTemplate", () => {
  it("returns the template as-is", () => {
    const template: Template = {
      description: "desc",
      name: "test",
      rules: [],
    };
    expect(defineTemplate(template)).toEqual(template);
  });
});

describe("rule", () => {
  it("returns the rule definition", () => {
    const result = defineRule({
      check: () => ({ status: "pass" }),
      description: "A test rule",
      domain: "test",
      files: ["package.json"],
      id: "test:check",
    });
    expect(result.id).toBe("test:check");
    expect(result.domain).toBe("test");
    expect(result.files).toEqual(["package.json"]);
  });

  it("rule check function works", async () => {
    const r = defineRule({
      check: (ctx) => {
        expect(ctx).toBe(mockTarget);
        return { status: "pass" };
      },
      description: "Check test",
      domain: "check-domain",
      files: ["package.json"],
      id: "check:test",
    });
    const result = await r.check(mockTarget);
    expect(result.status).toBe("pass");
  });
});
