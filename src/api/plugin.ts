import type { Type } from "arktype";

import { validateParams } from "@/api/validate.ts";
import type { CheckResult, Plugin as PluginInterface, Rule } from "@/types.ts";
import { Target } from "@/utils/fs.ts";

interface RuleSetRuleDef<P = unknown> {
  domain: string;
  files?: string[];
  id: string;
  name: string;
  params?: Type<P>;
  test: (args: {
    context: unknown;
    params?: P;
  }) => CheckResult | Promise<CheckResult>;
}

export class Plugin<T = unknown> implements PluginInterface {
  private readonly config: {
    // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
    context: (target: any) => T;
    domain: string;
    id: string;
  };
  private readonly ruleDefs: RuleSetRuleDef<unknown>[] = [];

  constructor(config: {
    // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
    context: (target: any) => T;
    domain: string;
    id: string;
  }) {
    this.config = config;
  }

  defineRule<P = unknown>(def: {
    domain: string;
    files?: string[];
    id: string;
    name: string;
    params?: Type<P>;
    test: (args: {
      context: T;
      params?: P;
    }) => CheckResult | Promise<CheckResult>;
  }): void {
    this.ruleDefs.push(def as unknown as RuleSetRuleDef<unknown>);
  }

  get id(): string {
    return this.config.id;
  }

  get rules(): Rule[] {
    return this.ruleDefs.map((ruleDef): Rule => {
      const base: Rule = {
        check: async (targetPath: string, params: unknown) => {
          const target = new Target(targetPath);
          let ctx: T;
          try {
            ctx = this.config.context(target);
          } catch {
            ctx = this.config.context(targetPath);
          }

          if (ruleDef.params) {
            const validated = validateParams(
              params,
              ruleDef.params as unknown as Type<unknown>,
            );
            if (!validated.ok) {
              return validated.error;
            }
            return await (
              ruleDef.test as (args: {
                context: T;
                params: unknown;
              }) => CheckResult | Promise<CheckResult>
            )({
              context: ctx,
              params: validated.value,
            });
          }

          return await (
            ruleDef.test as (args: {
              context: T;
              params: unknown;
            }) => CheckResult | Promise<CheckResult>
          )({
            context: ctx,
            params,
          });
        },
        description: ruleDef.name,
        domain: ruleDef.domain ?? this.config.domain,
        files: ruleDef.files ?? [],
        id: `${this.config.id}:${ruleDef.id}`,
      };
      if (ruleDef.params) {
        (base as Rule & { paramsSchema: Type }).paramsSchema = ruleDef.params;
      }
      return base;
    });
  }
}

// Backward compatibility: RuleSet was the previous name for Plugin.
// Keeping the alias makes existing imports and presets continue to work
// while new code should prefer `Plugin` / `definePlugin`.
export const RuleSet = Plugin;

// biome-ignore lint/style/useUnifiedTypeSignatures: intentional overload for Target|string backward compat
export function definePlugin<T>(config: {
  context: (target: Target) => T;
  domain: string;
  id: string;
}): Plugin<T>;
export function definePlugin<T>(config: {
  context: (targetPath: string) => T;
  domain: string;
  id: string;
}): Plugin<T>;
export function definePlugin<T>(config: {
  // biome-ignore lint/suspicious/noExplicitAny: backward compat requires any
  context: (target: any) => T;
  domain: string;
  id: string;
}): Plugin<T> {
  return new Plugin(config);
}
