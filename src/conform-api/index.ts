import type {
  CheckResult,
  ConformConfig,
  Rule,
  Target,
  Template,
} from "@/types.ts";

interface RuleSetRuleDef {
  domain?: string;
  files?: string[];
  id: string;
  name: string;
  test: (args: { context: unknown }) => CheckResult | Promise<CheckResult>;
}

export const Status = {
  fail: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "fail" };
    }
    return { message, status: "fail" };
  },
  pass: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "pass" };
    }
    return { message, status: "pass" };
  },
  warn: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "warn" };
    }
    return { message, status: "warn" };
  },
};

export class RuleSet<T = unknown> {
  private readonly config: {
    context: (target: Target) => T;
    domain?: string;
    id: string;
  };
  private readonly ruleDefs: RuleSetRuleDef[] = [];

  constructor(config: {
    context: (target: Target) => T;
    domain?: string;
    id: string;
  }) {
    this.config = config;
  }

  defineRule(def: {
    domain?: string;
    files?: string[];
    id: string;
    name: string;
    test: (args: { context: T }) => CheckResult | Promise<CheckResult>;
  }): void {
    this.ruleDefs.push(def as RuleSetRuleDef);
  }

  get rules(): Rule[] {
    return this.ruleDefs.map(
      (ruleDef): Rule => ({
        check: async (target: Target) => {
          const ctx = this.config.context(target);
          return await ruleDef.test({ context: ctx });
        },
        description: ruleDef.name,
        domain: ruleDef.domain ?? this.config.domain ?? "",
        files: ruleDef.files ?? [],
        id: `${this.config.id}:${ruleDef.id}`,
      }),
    );
  }
}

export function defineTemplate(template: Template): Template {
  return template;
}

export function defineRule(def: {
  check: (ctx: Target) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
}): Rule {
  return def;
}

export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}
