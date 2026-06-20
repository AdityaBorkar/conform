import { describe, expect, it } from "vitest";

import { renderJson } from "@/reporter/json.ts";
import { renderTui } from "@/reporter/tui.ts";
import type { RuleResult } from "@/types.ts";

function makeResult(overrides: Partial<RuleResult>): RuleResult {
  return {
    description: "Test rule",
    domain: "test-domain",
    files: ["package.json"],
    id: "test:rule",
    status: "pass",
    ...overrides,
  };
}

const sampleResults: RuleResult[] = [
  makeResult({ id: "a:one", status: "pass" }),
  makeResult({ id: "a:two", message: "watch out", status: "warn" }),
  makeResult({ id: "b:three", message: "broken", status: "fail" }),
];

describe("renderTui", () => {
  it("hides passing results by default", () => {
    const output = renderTui("test-template", sampleResults);
    expect(output).toContain("two");
    expect(output).toContain("three");
  });

  it("shows all results in verbose mode", () => {
    const output = renderTui("test-template", sampleResults, { verbose: true });
    expect(output).toContain("one");
    expect(output).toContain("two");
    expect(output).toContain("three");
  });

  it("includes summary counts", () => {
    const output = renderTui("test-template", sampleResults);
    expect(output).toContain("1 passed");
    expect(output).toContain("1 warned");
    expect(output).toContain("1 failed");
  });

  it("includes template name", () => {
    const output = renderTui("my-template", sampleResults);
    expect(output).toContain("my-template");
  });
});

describe("renderJson", () => {
  it("returns valid JSON", () => {
    const output = renderJson("test-template", "/tmp", sampleResults);
    const parsed = JSON.parse(output);
    expect(parsed.template).toBe("test-template");
    expect(parsed.path).toBe("/tmp");
  });

  it("hides passing results by default", () => {
    const output = renderJson("test-template", "/tmp", sampleResults);
    const parsed = JSON.parse(output);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results.every((r: RuleResult) => r.status !== "pass")).toBe(
      true,
    );
  });

  it("shows all results in verbose mode", () => {
    const output = renderJson("test-template", "/tmp", sampleResults, {
      verbose: true,
    });
    const parsed = JSON.parse(output);
    expect(parsed.results).toHaveLength(3);
  });

  it("summary counts include all results regardless of verbose", () => {
    const output = renderJson("test-template", "/tmp", sampleResults);
    const parsed = JSON.parse(output);
    expect(parsed.summary.pass).toBe(1);
    expect(parsed.summary.warn).toBe(1);
    expect(parsed.summary.fail).toBe(1);
  });
});
