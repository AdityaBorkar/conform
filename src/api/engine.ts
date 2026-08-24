import { presetResolver } from "@/api/preset.ts";
import { renderJson } from "@/cli/reporter/json.ts";
import { renderTui } from "@/cli/reporter/tui.ts";
import type {
  CheckResult,
  ConformOutput,
  GroupBy,
  Plugin,
  Preset,
  RuleConfig,
  RuleOverrides,
  RuleResult,
  Severity,
} from "@/types.ts";
import { loadConfig } from "@/utils/config.ts";

export interface ConformanceOptions {
  groupBy?: GroupBy;
  json?: boolean;
  verbose?: boolean;
}

export interface ConformanceResult {
  hasFail: boolean;
  hasWarn: boolean;
  output: ConformOutput;
  rendered: string;
}

export type ConformanceErrorCode = "no-config" | "preset-not-found";

// biome-ignore lint/style/useExportsLast: error type must be exported near code type
export interface ConformanceError {
  code: ConformanceErrorCode;
  message: string;
}

function normalizeSeverity(value: RuleConfig): Severity | "off" | null {
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

function parseOverride(rawOverride: RuleConfig | undefined): {
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

function mergePresetWithConfig(
  preset: Preset,
  config: { plugins?: Plugin[]; rules?: RuleOverrides },
): Preset {
  const plugins =
    config.plugins && config.plugins.length > 0
      ? [...preset.plugins, ...config.plugins]
      : preset.plugins;

  const rules: RuleOverrides | undefined =
    config.rules || preset.rules
      ? { ...(preset.rules ?? {}), ...(config.rules ?? {}) }
      : undefined;

  if (plugins === preset.plugins && rules === preset.rules) {
    return preset;
  }

  return {
    description: preset.description,
    name: preset.name,
    plugins,
    ...(rules ? { rules } : {}),
  };
}

export function isConformanceError(
  value: ConformanceResult | ConformanceError,
): value is ConformanceError {
  return "code" in value;
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

    if (rawOverride !== undefined && override === null) {
      const raw = Array.isArray(rawOverride)
        ? String((rawOverride as unknown[])[0])
        : String(rawOverride);
      results.push({
        description: rule.description,
        domain: rule.domain,
        files: rule.files,
        id: rule.id,
        message: `Invalid severity "${raw}" for rule "${rule.id}"`,
        status: "fail",
      });
      continue;
    }

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

export async function check(
  targetPath: string,
  opts: ConformanceOptions = {},
): Promise<ConformanceResult | ConformanceError> {
  const { verbose = false, groupBy = "domains", json = false } = opts;

  const config = await loadConfig(targetPath);
  if (!config) {
    return {
      code: "no-config",
      message: `No conform.config.ts found in ${targetPath}`,
    };
  }

  const preset = await presetResolver(config.preset);
  if (!preset) {
    return {
      code: "preset-not-found",
      message: `Preset '${config.preset}' not found`,
    };
  }

  const effectivePreset = mergePresetWithConfig(preset, config);
  const results = await runChecks(effectivePreset, targetPath);

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  const hasFail = failed > 0;
  const hasWarn = warned > 0;

  const visible = verbose
    ? results
    : results.filter((r) => r.status !== "pass");

  const output: ConformOutput = {
    path: targetPath,
    preset: preset.name,
    results: visible,
    summary: {
      fail: failed,
      pass: passed,
      warn: warned,
    },
  };

  if (groupBy === "files") {
    output.groupBy = "files";
  }

  const rendered = json
    ? renderJson(preset.name, targetPath, results, { groupBy, verbose })
    : renderTui(preset.name, results, { groupBy, verbose });

  return {
    hasFail,
    hasWarn,
    output,
    rendered,
  };
}
