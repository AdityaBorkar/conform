import { runChecks } from "@/api/engine.ts";
import { presetResolver } from "@/api/preset.ts";
import { renderJson } from "@/cli/reporter/json.ts";
import { renderTui } from "@/cli/reporter/tui.ts";
import type {
  ConformOutput,
  GroupBy,
  Plugin,
  Preset,
  RuleOverrides,
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
  error: ConformanceErrorCode;
  message: string;
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
  return "error" in value;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: pipeline orchestration is one cohesive flow
export async function check(
  targetPath: string,
  opts: ConformanceOptions = {},
): Promise<ConformanceResult | ConformanceError> {
  const { verbose = false, groupBy = "domains", json = false } = opts;

  const config = await loadConfig(targetPath);
  if (!config) {
    return {
      code: "no-config",
      error: "no-config",
      message: `No conform.config.ts found in ${targetPath}`,
    };
  }

  const preset = await presetResolver(config.preset);
  if (!preset) {
    return {
      code: "preset-not-found",
      error: "preset-not-found",
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

export const runConformance = check;
