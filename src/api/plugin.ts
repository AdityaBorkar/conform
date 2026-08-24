import type { CheckResult, Plugin as PluginInterface, Rule } from "@/types.ts";
import { Target } from "@/utils/fs.ts";

interface RuleSetRuleDef {
  domain?: string;
  files?: string[];
  id: string;
  name: string;
  test: (args: { context: unknown }) => CheckResult | Promise<CheckResult>;
}

export class Plugin<T = unknown> implements PluginInterface {
  private readonly config: {
    // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
    context: (target: any) => T;
    domain?: string;
    id: string;
  };
  private readonly ruleDefs: RuleSetRuleDef[] = [];

  constructor(config: {
    // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
    context: (target: any) => T;
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
          const target = new Target(targetPath);
          let ctx: T;
          try {
            ctx = this.config.context(target);
          } catch {
            ctx = this.config.context(targetPath);
          }
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

// biome-ignore lint/style/useUnifiedTypeSignatures: intentional overload for Target|string backward compat
export function definePlugin<T>(config: {
  context: (target: Target) => T;
  domain?: string;
  id: string;
}): Plugin<T>;
export function definePlugin<T>(config: {
  context: (targetPath: string) => T;
  domain?: string;
  id: string;
}): Plugin<T>;
export function definePlugin<T>(config: {
  // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
  context: (target: any) => T;
  domain?: string;
  id: string;
}): Plugin<T> {
  return new Plugin(config);
}
