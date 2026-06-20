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
      files: rule.files,
      id: rule.id,
      status: result.status,
    };
    if (result.message !== undefined) {
      entry.message = result.message;
    }
    results.push(entry);
  }

  return results;
}
