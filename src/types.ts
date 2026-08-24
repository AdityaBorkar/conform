import type { Type } from "arktype";

import type { AllBuiltinPlugins } from "@/plugins/index.ts";

type AnyPlugin = Plugin<any, any>;

export type Severity = "pass" | "warn" | "fail";

export type GroupBy = "domains" | "files";

export interface CheckResult {
  message?: string;
  status: Severity;
}

export interface PackageJson {
  author?: string | Record<string, unknown>;
  bin?: unknown;
  bugs?: unknown;
  contributors?: Array<string | Record<string, unknown>>;
  dependencies?: Record<string, string>;
  description?: string;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: unknown;
  files?: string[];
  homepage?: string;
  license?: string;
  main?: string;
  module?: string;
  name?: string;
  peerDependencies?: Record<string, string>;
  repository?: unknown;
  scripts?: Record<string, string>;
  sideEffects?: boolean | string[];
  type?: string;
  version?: string;
}

export interface Rule<P = unknown> {
  check: (ctx: string, params?: P) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
  paramsSchema?: Type<P>;
}

export interface Plugin<
  Id extends string = string,
  ParamMap extends Record<string, any> = Record<string, any>,
> {
  _paramMap: ParamMap;
  id: Id;
  rules: Rule<any>[];
}

export type RuleLevel = "warn" | "off" | "error";

export type RuleConfig<P = unknown> =
  P extends Record<string, any>
    ? RuleLevel | ({ level?: RuleLevel } & Partial<P>)
    : RuleLevel | ({ level?: RuleLevel } & Record<string, unknown>);

export type RuleOverrides = Record<string, RuleConfig<unknown>>;

// Auto-inferred param maps from plugins (full type-safe, no hardcoding)
export type InferPluginParamMap<P> =
  P extends Plugin<string, infer M> ? M : never;

export type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

export type InferPresetParamMap<Ps extends readonly AnyPlugin[]> =
  UnionToIntersection<InferPluginParamMap<Ps[number]>>;

/**
 * Registry that maps known Rule IDs to their validated params type.
 * Auto-inferred from the arktype `params` schemas defined in `src/plugins/*.ts`
 * via `InferPresetParamMap<AllBuiltinPlugins>` — single source of truth.
 * Unknown keys fall back to `RuleConfig<unknown>`.
 */
export type RuleRegistry = InferPresetParamMap<AllBuiltinPlugins>;

export type StrictRuleConfig<K extends string> = K extends keyof RuleRegistry
  ? RuleConfig<RuleRegistry[K]>
  : RuleConfig<unknown>;

export type StrictRuleOverrides = {
  [K in keyof RuleRegistry]?: StrictRuleConfig<K>;
} & Record<string, RuleConfig<unknown>>;

export type AutoRuleRegistry<Ps extends readonly AnyPlugin[]> =
  InferPresetParamMap<Ps> & RuleRegistry;

export type StrictPresetRules<Ps extends readonly AnyPlugin[]> = {
  [K in keyof AutoRuleRegistry<Ps>]?: RuleConfig<AutoRuleRegistry<Ps>[K]>;
} & {
  [K in string as K extends keyof AutoRuleRegistry<Ps>
    ? never
    : K]?: RuleConfig<unknown>;
};

export interface Preset {
  description: string;
  name: string;
  plugins: Plugin[];
  rules?: StrictRuleOverrides;
}

export interface PresetWithPlugins<Ps extends readonly AnyPlugin[]> {
  description: string;
  name: string;
  plugins: Ps;
  rules?: StrictPresetRules<Ps>;
}

export interface RuleResult {
  description: string;
  domain: string;
  files: string[];
  id: string;
  message?: string;
  status: Severity;
}

export interface ConformConfig {
  plugins?: Plugin[];
  preset: string;
  rules?: StrictRuleOverrides;
}

export interface ConformOutput {
  groupBy?: GroupBy;
  path: string;
  preset: string;
  results: RuleResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}
