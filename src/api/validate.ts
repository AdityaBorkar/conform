import type { Type } from "arktype";
import { type } from "arktype";

import type { CheckResult } from "@/types.ts";

/**
 * Single validation adapter for arktype params.
 * Owns the `Invalid params: …` formatting so callers don't duplicate it.
 * Used by both `defineRule` and `Plugin#defineRule` — one seam, two adapters.
 */
export function validateParams<P>(
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
