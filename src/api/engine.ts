import { type } from "arktype";

import { isMonorepoConfig } from "@/api/config.ts";
import { presetResolver } from "@/api/preset.ts";
import { renderJson } from "@/cli/reporter/json.ts";
import { renderTui } from "@/cli/reporter/tui.ts";
import type {
  CheckResult,
  ConformOutput,
  GroupBy,
  MonorepoConformOutput,
  MonorepoPackageResult,
  Plugin,
  Preset,
  RuleConfig,
  RuleOverrides,
  RuleResult,
  Severity,
} from "@/types.ts";
import {
  loadAndResolveMonorepo,
  loadConfig,
  loadRawConfig,
} from "@/utils/config.ts";

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

export interface MonorepoConformanceResult {
  hasFail: boolean;
  hasWarn: boolean;
  outputs: ConformOutput[];
  packageResults: MonorepoPackageResult[];
  rendered: string;
  summary: { pass: number; warn: number; fail: number };
}

export type ConformanceErrorCode =
  | "no-config"
  | "preset-not-found"
  | "monorepo-unconfigured-package"
  | "monorepo-extraneous-package"
  | "monorepo-no-workspaces"
  | "monorepo-config-error";

// biome-ignore lint/style/useExportsLast: error type must be exported near code type
export interface ConformanceError {
  code: ConformanceErrorCode;
  message: string;
}

const ruleLevelSchema = type("'warn'|'off'|'error'");

const ruleOverrideObjectSchema = type({
  "[string]": "unknown",
  "level?": "'warn'|'off'|'error'|undefined",
}).narrow((data, ctx) => {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return ctx.mustBe("an object");
  }
  return true;
});

function normalizeLevel(level: unknown): Severity | "off" | null {
  const parsed = ruleLevelSchema(level);
  if (parsed instanceof type.errors) {
    return null;
  }
  if (level === "error") {
    return "fail";
  }
  return level as Severity | "off";
}

function parseOverride(rawOverride: RuleConfig | undefined): {
  params: unknown;
  severity: Severity | "off" | null | undefined;
} {
  if (rawOverride === undefined) {
    return { params: undefined, severity: undefined };
  }
  if (typeof rawOverride === "string") {
    const severity = normalizeLevel(rawOverride);
    if (severity === null) {
      return { params: undefined, severity: null };
    }
    return { params: undefined, severity };
  }
  if (ruleOverrideObjectSchema(rawOverride) instanceof type.errors) {
    return { params: undefined, severity: null };
  }
  const rec = rawOverride as Record<string, unknown>;
  const hasLevel = "level" in rec;
  let severity: Severity | "off" | null | undefined;
  if (hasLevel) {
    const rawLevel = rec["level"];
    if (rawLevel === undefined) {
      severity = undefined;
    } else {
      const normalized = normalizeLevel(rawLevel);
      if (normalized === null) {
        return { params: undefined, severity: null };
      }
      severity = normalized;
    }
  } else {
    severity = undefined;
  }
  const { level: _level, ...rest } = rec;
  const params = Object.keys(rest).length > 0 ? rest : undefined;
  return { params, severity };
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
  value: ConformanceResult | MonorepoConformanceResult | ConformanceError,
): value is ConformanceError {
  return "code" in value;
}

export function isMonorepoConformanceResult(
  value: ConformanceResult | MonorepoConformanceResult | ConformanceError,
): value is MonorepoConformanceResult {
  return "packageResults" in (value as unknown as Record<string, unknown>);
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
      const raw =
        rawOverride !== null &&
        typeof rawOverride === "object" &&
        "level" in (rawOverride as Record<string, unknown>)
          ? String((rawOverride as Record<string, unknown>)["level"])
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

async function buildPackageConformance(
  targetPath: string,
  opts: ConformanceOptions,
  effectivePreset: Preset,
  preset: Preset,
): Promise<{
  hasFail: boolean;
  hasWarn: boolean;
  output: ConformOutput;
  rendered: string;
  results: RuleResult[];
}> {
  const { verbose = false, groupBy = "domains", json = false } = opts;
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
    summary: { fail: failed, pass: passed, warn: warned },
  };
  if (groupBy === "files") {
    output.groupBy = "files";
  }
  const rendered = json
    ? renderJson(preset.name, targetPath, results, { groupBy, verbose })
    : renderTui(preset.name, results, { groupBy, verbose });
  return { hasFail, hasWarn, output, rendered, results };
}

export async function check(
  targetPath: string,
  opts: ConformanceOptions = {},
): Promise<ConformanceResult | MonorepoConformanceResult | ConformanceError> {
  const raw = await loadRawConfig(targetPath);
  if (raw !== null && isMonorepoConfig(raw)) {
    return checkMonorepo(targetPath, opts);
  }

  const config = await loadConfig(targetPath);
  if (!config) {
    // If loadRawConfig was monorepo but loadConfig returned null, we already handled above.
    // Otherwise check if raw was non-null but not valid config -> treat as no-config
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
  const built = await buildPackageConformance(
    targetPath,
    opts,
    effectivePreset,
    preset,
  );

  return {
    hasFail: built.hasFail,
    hasWarn: built.hasWarn,
    output: built.output,
    rendered: built.rendered,
  };
}

export async function checkMonorepo(
  rootDir: string,
  opts: ConformanceOptions = {},
): Promise<MonorepoConformanceResult | ConformanceError> {
  const { groupBy = "domains", json = false } = opts;

  let resolved: Awaited<ReturnType<typeof loadAndResolveMonorepo>>;
  try {
    resolved = await loadAndResolveMonorepo(rootDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isNoWorkspaces = message.includes("No workspaces field");
    const isUnconfigured = message.includes("No preset/rules defined");
    const isExtraneous = message.includes("does not match any workspace");
    let code: ConformanceErrorCode = "monorepo-config-error";
    if (isNoWorkspaces) {
      code = "monorepo-no-workspaces";
    } else if (isUnconfigured) {
      code = "monorepo-unconfigured-package";
    } else if (isExtraneous) {
      code = "monorepo-extraneous-package";
    }
    return { code, message };
  }

  if (!resolved) {
    return {
      code: "no-config",
      message: `No conform.config.ts found in ${rootDir}`,
    };
  }

  const packageResults: MonorepoPackageResult[] = [];
  const outputs: ConformOutput[] = [];
  let totalPass = 0;
  let totalWarn = 0;
  let totalFail = 0;
  let hasFail = false;
  let hasWarn = false;

  for await (const [pkgPath, cfg] of resolved.mapping) {
    const preset = await presetResolver(cfg.preset);
    if (!preset) {
      return {
        code: "preset-not-found",
        message: `Preset '${cfg.preset}' not found for package ${pkgPath}`,
      };
    }
    const effectivePreset = mergePresetWithConfig(preset, cfg);
    const built = await buildPackageConformance(
      pkgPath,
      opts,
      effectivePreset,
      preset,
    );

    totalPass += built.output.summary.pass;
    totalWarn += built.output.summary.warn;
    totalFail += built.output.summary.fail;
    hasFail = hasFail || built.hasFail;
    hasWarn = hasWarn || built.hasWarn;

    outputs.push(built.output);
    packageResults.push({
      hasFail: built.hasFail,
      hasWarn: built.hasWarn,
      output: built.output,
      path: pkgPath,
      rendered: built.rendered,
    });
  }

  let rendered: string;
  if (json) {
    const monorepoOutput: MonorepoConformOutput = {
      outputs,
      path: rootDir,
      summary: { fail: totalFail, pass: totalPass, warn: totalWarn },
    };
    if (groupBy === "files") {
      // per-package outputs already carry groupBy; monorepo envelope mirrors it
      (monorepoOutput as unknown as Record<string, unknown>)["groupBy"] =
        "files";
    }
    rendered = JSON.stringify(monorepoOutput, null, 2);
  } else {
    // TUI: prefix each package with a header and delegate to per-package TUI
    const blocks: string[] = [];
    for (const pr of packageResults) {
      const header = `━━ ${pr.path} (${pr.output.preset}) ━━`;
      // indent per-package rendered with package header
      blocks.push(`${header}\n${pr.rendered}`);
    }
    const summaryLine = `\nSummary: ${totalPass} passed · ${totalWarn} warned · ${totalFail} failed across ${packageResults.length} packages`;
    rendered = `${blocks.join("\n\n")}${summaryLine}`;
    // Verbose filtering already applied per package; summary aggregates all
  }

  return {
    hasFail,
    hasWarn,
    outputs,
    packageResults,
    rendered,
    summary: { fail: totalFail, pass: totalPass, warn: totalWarn },
  };
}
