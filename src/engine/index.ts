import type { CheckContext, RuleResult, Template } from "@/types.ts";

export async function runChecks(
  template: Template,
  ctx: CheckContext,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  for (const rule of template.rules) {
    const result = await rule.check(ctx);
    const entry: RuleResult = {
      description: rule.description,
      domain: rule.domain,
      group: rule.group,
      id: rule.id,
      severity: rule.severity,
      status: result.status,
    };
    if (result.message !== undefined) {
      entry.message = result.message;
    }
    results.push(entry);
  }

  return results;
}
