import type { CheckContext, RuleResult, Template } from "./types.ts";

export async function runChecks(
	template: Template,
	ctx: CheckContext,
): Promise<RuleResult[]> {
	const results: RuleResult[] = [];

	for (const rule of template.rules) {
		const result = await rule.check(ctx);
		results.push({
			id: rule.id,
			group: rule.group,
			description: rule.description,
			severity: rule.severity,
			status: result.status,
			message: result.message,
		});
	}

	return results;
}
