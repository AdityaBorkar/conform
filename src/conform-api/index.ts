import type {
  CheckContext,
  CheckResult,
  ConformConfig,
  Rule,
  Template,
} from "@/types.ts";

export function defineTemplate(template: Template): Template {
  return template;
}

export function rule(def: {
  id: string;
  domain: string;
  files: string[];
  description: string;
  check: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}): Rule {
  return def;
}

export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}

export function domain(name: string) {
  return {
    domain: name,
    rule(def: {
      id: string;
      files: string[];
      description: string;
      check: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
    }): Rule {
      return { ...def, domain: name };
    },
  };
}
