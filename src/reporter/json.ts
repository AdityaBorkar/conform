import type { ConformOutput, RuleResult } from "../types.ts";

export function renderJson(
	templateName: string,
	targetPath: string,
	results: RuleResult[],
	options: { verbose?: boolean } = {},
): string {
	const { verbose = false } = options;
	const visible = verbose
		? results
		: results.filter((r) => r.status !== "pass");

	const passed = results.filter((r) => r.status === "pass").length;
	const warned = results.filter((r) => r.status === "warn").length;
	const failed = results.filter((r) => r.status === "fail").length;

	const output: ConformOutput = {
		template: templateName,
		path: targetPath,
		results: visible,
		summary: {
			pass: passed,
			warn: warned,
			fail: failed,
		},
	};

	return JSON.stringify(output, null, 2);
}
