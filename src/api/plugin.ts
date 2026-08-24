import type { CheckResult, Plugin as PluginInterface, Rule } from "@/types.ts";

interface RuleSetRuleDef {
  domain?: string;
  files?: string[];
  id: string;
  name: string;
  test: (args: { context: unknown }) => CheckResult | Promise<CheckResult>;
}

export class Plugin<T = unknown> implements PluginInterface {
  private readonly config: {
    context: (targetPath: string) => T;
    domain?: string;
    id: string;
  };
  private readonly ruleDefs: RuleSetRuleDef[] = [];

  constructor(config: {
    context: (targetPath: string) => T;
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

  get id(): string {
    return this.config.id;
  }

  get rules(): Rule[] {
    return this.ruleDefs.map(
      (ruleDef): Rule => ({
        check: async (targetPath: string) => {
          const ctx = this.config.context(targetPath);
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

// Backward compatibility: RuleSet was the previous name for Plugin.
// Keeping the alias makes existing imports and templates continue to work
// while new code should prefer `Plugin` / `definePlugin`.
export const RuleSet = Plugin;

export function definePlugin<T>(config: {
  context: (targetPath: string) => T;
  domain?: string;
  id: string;
}): Plugin<T> {
  return new Plugin(config);
}
