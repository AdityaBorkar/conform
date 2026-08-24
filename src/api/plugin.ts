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

export class Plugin<
  Id extends string = string,
  T = unknown,
  M extends Record<string, any> = Record<string, any>,
> implements PluginInterface<Id, M>
{
  private readonly config: {
    context: (target: Target) => T;
    id: Id;
  };
  private readonly ruleDefs: PluginRuleDef<unknown>[] = [];

  constructor(config: {
    context: (target: Target) => T;
    id: Id;
  }) {
    this.config = config;
  }

  defineRule<P, const RId extends string>(def: {
    domain: string;
    files?: string[];
    id: RId;
    name: string;
    params: Type<P>;
    test: (args: {
      context: T;
      params?: P;
    }) => CheckResult | Promise<CheckResult>;
  }): Plugin<Id, T, M & Record<`${Id}/${RId}`, P>>;

  defineRule<const RId extends string>(def: {
    domain: string;
    files?: string[];
    id: RId;
    name: string;
    params?: undefined;
    test: (args: {
      context: T;
      params?: never;
    }) => CheckResult | Promise<CheckResult>;
  }): Plugin<Id, T, M>;

  defineRule(def: any): Plugin<Id, T, any> {
    this.ruleDefs.push(def as unknown as PluginRuleDef<unknown>);
    return this as unknown as Plugin<Id, T, any>;
  }

  get id(): Id {
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
        domain: ruleDef.domain,
        files: ruleDef.files ?? [],
        id: `${this.config.id}/${ruleDef.id}`,
      };
      if (ruleDef.params) {
        (base as Rule & { paramsSchema: Type }).paramsSchema = ruleDef.params;
      }
      return base;
    });
  }
}

export function definePlugin<const Id extends string, T>(config: {
  context: (target: Target) => T;
  id: Id;
}): Plugin<Id, T, {}> {
  return new Plugin<Id, T, {}>(config);
}
