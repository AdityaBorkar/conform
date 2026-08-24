import type {
  CheckResult,
  Preset,
  RuleOverrides,
  RuleResult,
  Severity,
} from "@/types.ts";

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

function parseOverride(
  rawOverride: import("@/types.ts").RuleConfig | undefined,
): {
  params: unknown;
  severity: Severity | "off" | null | undefined;
} {
  if (rawOverride === undefined) {
    return { params: undefined, severity: undefined };
  }
  return {
    params: Array.isArray(rawOverride) ? rawOverride[1] : undefined,
    severity: normalizeSeverity(rawOverride),
  };
}

function coerceStatus(
  original: Severity,
  override: Severity | "off" | null | undefined,
): Severity {
  if (override !== undefined && override !== null && original !== "pass") {
    return override as Severity;
  }
  return original;
}

export async function runChecks(
  preset: Preset,
  targetPath: string,
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  const overrides: RuleOverrides = preset.rules ?? {};
  const allRules = preset.plugins.flatMap((plugin) => plugin.rules);

  for await (const rule of allRules) {
    const rawOverride = overrides[rule.id];
    const { severity: override, params: rawParams } =
      parseOverride(rawOverride);

    if (override === "off") {
      continue;
    }

    const result = await (
      rule.check as (ctx: string, params: unknown) => Promise<CheckResult>
    )(targetPath, rawParams);

    const status = coerceStatus(result.status, override);

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
