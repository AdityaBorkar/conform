import type { Type } from "arktype";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ParamMap extends Record<string, any> = Record<string, any>,
> {
  _paramMap?: ParamMap;
  id: Id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: Rule<any>[];
}

export type RuleLevel = "warn" | "off" | "error";

export type RuleConfig<P = unknown> =
  | { level: RuleLevel }
  | ({ level: Exclude<RuleLevel, "off"> } & ({ params: P } | { options: P }));

export type RuleOverrides = Record<string, RuleConfig<unknown>>;

/**
 * Shared param shapes — single source of truth for Plugin schemas and registry.
 */
export interface HuskyHookSpec {
  contains: string;
  file: string;
}

export interface RequiredFieldsParams {
  fields: string[];
}

export interface GitIgnoreExcludesParams {
  file_expressions: string[];
}

export interface HuskyHookParams {
  hooks: HuskyHookSpec[];
}

/**
 * Registry that maps known Rule IDs to their validated params type.
 * Extend via declaration merging in plugins or custom presets:
 * ```ts
 * declare module "@/types.ts" {
 *   interface RuleRegistry { "my-plugin:my-rule": MyParams }
 * }
 * ```
 * Known keys are strictly typed; unknown keys fall back to `RuleConfig<unknown>`.
 */
export interface RuleRegistry {
  "gitignore:excludes": GitIgnoreExcludesParams;
  "husky:hook": HuskyHookParams;
  "package-json:required-fields": RequiredFieldsParams;
}

export type StrictRuleConfig<K extends string> = K extends keyof RuleRegistry
  ? RuleConfig<RuleRegistry[K]>
  : RuleConfig<unknown>;

export type StrictRuleOverrides = {
  [K in keyof RuleRegistry]?: StrictRuleConfig<K>;
} & Record<string, RuleConfig<unknown>>;

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

export type InferPresetParamMap<Ps extends readonly Plugin<any, any>[]> =
  UnionToIntersection<InferPluginParamMap<Ps[number]>>;

export type AutoRuleRegistry<Ps extends readonly Plugin<any, any>[]> =
  InferPresetParamMap<Ps> & RuleRegistry;

export type StrictPresetRules<Ps extends readonly Plugin<any, any>[]> = {
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

export interface PresetWithPlugins<Ps extends readonly Plugin<any, any>[]> {
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
