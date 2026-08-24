import { resolve } from "node:path";
import process from "node:process";

import { runChecks } from "@/api/engine.ts";
import { presetResolver } from "@/api/preset.ts";
import type { Plugin, Preset, RuleOverrides } from "@/types.ts";
import { loadConfig } from "@/utils/config.ts";

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

export async function CheckCommand({
  path,
  json,
  verbose: _verbose,
  group,
}: {
  path: string;
  json: boolean;
  verbose: boolean;
  group: string | undefined;
}) {
  if (json && group !== undefined) {
    process.stderr.write(
      "Error: --group is not supported with --json output.\n",
    );
    process.exit(1);
  }

  const targetPath = resolve(path);

  const config = await loadConfig(targetPath);
  if (!config) {
    process.exit(2);
  }

  const preset = await presetResolver(config.preset);
  if (!preset) {
    process.exit(2);
  }

  const effectivePreset = mergePresetWithConfig(preset, config);

  const results = await runChecks(effectivePreset, targetPath);

  const hasFail = results.some((r) => r.status === "fail");
  const hasWarn = results.some((r) => r.status === "warn");

  if (hasFail) {
    process.exit(1);
  }
  if (hasWarn) {
    process.exit(2);
  }
  process.exit(0);
}
