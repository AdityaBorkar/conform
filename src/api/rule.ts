import type { CheckResult, Rule } from "@/types.ts";

export function defineRule(def: {
  check: (ctx: string) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
}): Rule {
  return def;
}
