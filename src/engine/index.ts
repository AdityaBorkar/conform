import type { RuleResult, Target, Template } from "@/types.ts";

export async function runChecks(
  template: Template,
  target: Target,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  for await (const rule of template.rules) {
    const result = await rule.check(target);
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
