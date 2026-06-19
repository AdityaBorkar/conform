import type { CheckContext, RuleResult, Template } from "@/types.ts";

export async function runChecks(
  template: Template,
  ctx: CheckContext,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  for (const rule of template.rules) {
    const result = await rule.check(ctx);
    results.push({
      description: rule.description,
      group: rule.group,
      id: rule.id,
      message: result.message,
      severity: rule.severity,
      status: result.status,
    });
  }

  return results;
}
