import type { RuleResult, Template } from "@/types.ts";

export async function runChecks(
  template: Template,
  targetPath: string,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  for await (const rule of template.rules) {
    const result = await rule.check(targetPath);
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
