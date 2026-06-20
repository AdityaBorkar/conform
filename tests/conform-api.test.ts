import { describe, expect, it } from "vitest";

import {
  defineConfig,
  defineTemplate,
  domain,
  rule,
} from "@/conform-api/index.ts";
import type { CheckContext, ConformConfig, Template } from "@/types.ts";

const mockCtx: CheckContext = {
  fileExists: () => false,
  packageJson: null,
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
    const result = rule({
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
});

describe("domain", () => {
  it("creates a scoped rule builder that injects domain", () => {
    const d = domain("my-domain");
    const r = d.rule({
      check: () => ({ message: "nope", status: "fail" }),
      description: "Scoped rule",
      files: ["package.json"],
      id: "scoped:rule",
    });
    expect(r.domain).toBe("my-domain");
    expect(r.id).toBe("scoped:rule");
  });

  it("rule check function works", async () => {
    const d = domain("check-domain");
    const r = d.rule({
      check: (ctx) => {
        expect(ctx).toBe(mockCtx);
        return { status: "pass" };
      },
      description: "Check test",
      files: ["package.json"],
      id: "check:test",
    });
    const result = await r.check(mockCtx);
    expect(result.status).toBe("pass");
  });
});
