export type Severity = "pass" | "warn" | "fail";

export type GroupBy = "domains" | "files";

export interface CheckResult {
  message?: string;
  status: Severity;
}

export interface PackageJson {
  bin?: unknown;
  bugs?: unknown;
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

export interface Rule {
  check: (ctx: string) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
}

export interface Plugin {
  id: string;
  rules: Rule[];
}

export type RuleSeverity = Severity | "off" | "error";

export type RuleConfig = RuleSeverity | [RuleSeverity, ...unknown[]];

export type RuleOverrides = Record<string, RuleConfig>;

export interface Preset {
  description: string;
  name: string;
  plugins: Plugin[];
  rules?: RuleOverrides;
}

/** @deprecated Use Preset instead. */
export type Template = Preset;

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
  rules?: RuleOverrides;
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
