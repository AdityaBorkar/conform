import type { RuleOverrides, RuleResult, Severity, Template } from "@/types.ts";

function normalizeSeverity(
  value: import("@/types.ts").RuleConfig,
): Severity | "off" | null {
  const raw: string = Array.isArray(value)
    ? (value[0] as string)
    : (value as string);
  if (raw === "off") {
    return "off";
  }
  if (raw === "error" || raw === "fail") {
    return "fail";
  }
  if (raw === "warn") {
    return "warn";
  }
  if (raw === "pass") {
    return "pass";
  }
  return null;
}

export async function runChecks(
  template: Template,
  targetPath: string,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  const overrides: RuleOverrides = template.rules ?? {};
  const allRules = template.plugins.flatMap((plugin) => plugin.rules);

  for await (const rule of allRules) {
    const rawOverride = overrides[rule.id];
    const override =
      rawOverride === undefined ? undefined : normalizeSeverity(rawOverride);

    if (override === "off") {
      continue;
    }

    const result = await rule.check(targetPath);

    let status: Severity = result.status;
    // If a rule is configured to a different severity, coerce non-passing
    // results to the configured level. `pass` results stay as pass.
    // This mirrors oxc/eslint where `rules: { "plugin/rule": "warn" }`
    // downgrades an error to a warning. `off` skips the rule entirely above.
    if (override !== undefined && override !== null && status !== "pass") {
      status = override as Severity;
    }

    const entry: RuleResult = {
      description: rule.description,
      domain: rule.domain,
      files: rule.files,
      id: rule.id,
      status,
    };
    if (result.message !== undefined) {
      entry.message = result.message;
    }
    results.push(entry);
  }

  return results;
}
