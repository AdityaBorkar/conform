import type { Type } from "arktype";
import { type } from "arktype";

import type { CheckResult, Plugin as PluginInterface, Rule } from "@/types.ts";
import { Target } from "@/utils/fs.ts";

/**
 * Single validation adapter for arktype params.
 * Owns the `Invalid params: …` formatting so callers don't duplicate it.
 * Used by `Plugin#defineRule` (all Rules are plugin-owned).
 */
function validateParams<P>(
  params: unknown,
  schema: Type<P> | undefined,
): { ok: true; value: P | undefined } | { ok: false; error: CheckResult } {
  if (!schema) {
    return { ok: true, value: params as P | undefined };
  }
  if (params === undefined) {
    return { ok: true, value: undefined };
  }
  const parsed = (schema as unknown as (data: unknown) => unknown)(params);
  if (parsed instanceof type.errors) {
    const message = Object.entries(parsed.flatProblemsByPath)
      .map(
        ([path, problems]) => `${path}: ${(problems as string[]).join(", ")}`,
      )
      .join("; ");
    return {
      error: { message: `Invalid params: ${message}`, status: "fail" },
      ok: false,
    };
  }
  return { ok: true, value: parsed as P };
}

interface PluginRuleDef<P = unknown> {
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
    context: (target: Target) => T;
    domain: string;
    id: string;
  };
  private readonly ruleDefs: PluginRuleDef<unknown>[] = [];

  constructor(config: {
    context: (target: Target) => T;
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
    this.ruleDefs.push(def as unknown as PluginRuleDef<unknown>);
  }

  get id(): string {
    return this.config.id;
  }

  get rules(): Rule[] {
    return this.ruleDefs.map((ruleDef): Rule => {
      const base: Rule = {
        check: async (targetPath: string, params: unknown) => {
          const target = new Target(targetPath);
          const ctx = this.config.context(target);

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

export function definePlugin<T>(config: {
  context: (target: Target) => T;
  domain: string;
  id: string;
}): Plugin<T> {
  return new Plugin(config);
}
