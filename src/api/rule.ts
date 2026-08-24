import type { Type } from "arktype";

import { validateParams } from "@/api/validate.ts";
import type { CheckResult, Rule } from "@/types.ts";

export function defineRule<P = unknown>(def: {
  check: (ctx: string, params?: P) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
  params?: Type<P>;
}): Rule<P> {
  const paramsSchema = def.params as Type<P> | undefined;
  const originalCheck = def.check as (
    ctx: string,
    params?: P,
  ) => CheckResult | Promise<CheckResult>;

  if (!paramsSchema) {
    return {
      check: originalCheck,
      description: def.description,
      domain: def.domain,
      files: def.files,
      id: def.id,
    } as Rule<P>;
  }

  // biome-ignore lint/correctness/useQwikValidLexicalScope: not a Qwik component, plain closure
  const wrappedCheck = (ctx: string, params?: P) => {
    const validated = validateParams<P>(params, paramsSchema);
    if (!validated.ok) {
      return validated.error;
    }
    return originalCheck(ctx, validated.value);
  };

  return {
    check: wrappedCheck,
    description: def.description,
    domain: def.domain,
    files: def.files,
    id: def.id,
    paramsSchema: paramsSchema as Type<unknown>,
  } as unknown as Rule<P>;
}
