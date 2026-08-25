import type { Type } from "arktype";

export type AnyPlugin = Plugin<string, Record<string, unknown>>;

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
  workspaces?: string[] | { packages: string[]; nohoist?: string[] };
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
  ParamMap extends Record<string, unknown> = Record<string, unknown>,
> {
  _paramMap: ParamMap;
  id: Id;
  rules: Rule<unknown>[];
}

export type RuleLevel = "warn" | "off" | "error";

export type RuleConfig<P = unknown> =
  P extends Record<string, unknown>
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

// ---------------------------------------------------------------------------
// Dynamic global registry — no hardcoded AllBuiltinPlugins list.
// All plugins exported from `@/plugins/index.ts` are auto-discovered at
// type-level via `typeof import(...)`. Adding `export { foo } from "./foo.ts"`
// automatically extends the registry without touching this file.
// This is type-only and avoids a value import cycle (types.ts <-> plugins).
// ---------------------------------------------------------------------------
type _PluginModule = typeof import("@/plugins/index.ts");
type _BuiltinPluginUnion = {
  [K in keyof _PluginModule]: _PluginModule[K] extends AnyPlugin
    ? _PluginModule[K]
    : never;
}[keyof _PluginModule];

type AllBuiltinPlugins = readonly _BuiltinPluginUnion[];

/**
 * Registry that maps known Rule IDs to their validated params type.
 * Auto-inferred from the arktype `params` schemas defined in `src/plugins/*.ts`
 * via `InferPresetParamMap<AllBuiltinPlugins>` — single source of truth.
 * `AllBuiltinPlugins` is itself derived from the `@/plugins/index.ts` barrel,
 * so no hardcoded plugin list is needed.
 * Unknown keys fall back to `RuleConfig<unknown>`.
 */
export type RuleRegistry = InferPresetParamMap<AllBuiltinPlugins>;

export type StrictRuleConfig<K extends string> = K extends keyof RuleRegistry
  ? RuleConfig<RuleRegistry[K]>
  : RuleConfig<unknown>;

export type StrictRuleOverrides = {
  [K in keyof RuleRegistry]?: StrictRuleConfig<K>;
} & Record<string, RuleConfig<unknown>>;

/**
 * Per-preset registry derived from the preset's own plugins.
 * Used by `StrictPresetRules<Ps>` to provide fully local, auto-inferred
 * typing — no global hardcoding.
 */
export type PresetRuleRegistry<Ps extends readonly AnyPlugin[]> =
  InferPresetParamMap<Ps>;

// Kept for backward compatibility — previously `InferPresetParamMap<Ps> & RuleRegistry`.
// Prefer `PresetRuleRegistry<Ps>` / `StrictPresetRules<Ps>` for per-preset locality.
export type AutoRuleRegistry<Ps extends readonly AnyPlugin[]> =
  InferPresetParamMap<Ps> & RuleRegistry;

export type StrictPresetRules<Ps extends readonly AnyPlugin[]> = {
  [K in keyof PresetRuleRegistry<Ps>]?: RuleConfig<PresetRuleRegistry<Ps>[K]>;
} & {
  // Unknown rule IDs still accepted, but typed as `unknown` params.
  [K in string as K extends keyof PresetRuleRegistry<Ps>
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

export type MonorepoConfig = Record<string, ConformConfig>;

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

export interface MonorepoConformOutput {
  outputs: ConformOutput[];
  path: string;
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

export interface MonorepoPackageResult {
  hasFail: boolean;
  hasWarn: boolean;
  output: ConformOutput;
  path: string;
  rendered: string;
}
