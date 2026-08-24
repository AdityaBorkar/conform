import { resolve } from "node:path";
import process from "node:process";

import { runChecks } from "@/api/engine.ts";
import { resolver } from "@/api/resolver.ts";
import type { Plugin, RuleOverrides, Template } from "@/types.ts";
import { loadConfig } from "@/utils/config.ts";

function mergeTemplateWithConfig(
  template: Template,
  config: { plugins?: Plugin[]; rules?: RuleOverrides },
): Template {
  const plugins =
    config.plugins && config.plugins.length > 0
      ? [...template.plugins, ...config.plugins]
      : template.plugins;

  const rules: RuleOverrides | undefined =
    config.rules || template.rules
      ? { ...(template.rules ?? {}), ...(config.rules ?? {}) }
      : undefined;

  if (plugins === template.plugins && rules === template.rules) {
    return template;
  }

  return {
    description: template.description,
    name: template.name,
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

  const template = await resolver(config.template);
  if (!template) {
    process.exit(2);
  }

  const effectiveTemplate = mergeTemplateWithConfig(template, config);

  const results = await runChecks(effectiveTemplate, targetPath);

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
