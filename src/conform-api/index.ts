import type {
  CheckResult,
  ConformConfig,
  Rule,
  Target,
  Template,
} from "@/types.ts";

export function defineTemplate(template: Template): Template {
  return template;
}

export function defineRule(def: {
  id: string;
  domain: string;
  files: string[];
  description: string;
  check: (ctx: Target) => CheckResult | Promise<CheckResult>;
}): Rule {
  return def;
}

export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}
