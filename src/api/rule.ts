import type { Type } from "arktype";
import { type } from "arktype";

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
    if (params === undefined) {
      return originalCheck(ctx, undefined as P);
    }
    const parsed = (paramsSchema as unknown as (data: unknown) => unknown)(
      params,
    );
    if (parsed instanceof type.errors) {
      const message = Object.entries(parsed.flatProblemsByPath)
        .map(
          ([path, problems]) => `${path}: ${(problems as string[]).join(", ")}`,
        )
        .join("; ");
      return {
        message: `Invalid params: ${message}`,
        status: "fail",
      } as CheckResult;
    }
    return originalCheck(ctx, parsed as P);
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
