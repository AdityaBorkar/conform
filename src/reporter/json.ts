import type { ConformOutput, GroupBy, RuleResult } from "@/types.ts";

export function renderJson(
  templateName: string,
  targetPath: string,
  results: RuleResult[],
  options: { verbose?: boolean; groupBy?: GroupBy } = {},
): string {
  const { verbose = false, groupBy = "domains" } = options;
  const visible = verbose
    ? results
    : results.filter((r) => r.status !== "pass");

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  const output: ConformOutput = {
    path: targetPath,
    results: visible,
    summary: {
      fail: failed,
      pass: passed,
      warn: warned,
    },
    template: templateName,
  };

  if (groupBy === "files") {
    output.groupBy = "files";
  }

  return JSON.stringify(output, null, 2);
}
