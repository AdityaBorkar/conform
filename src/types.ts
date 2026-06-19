export type Severity = "pass" | "warn" | "fail";

export type RuleSeverity = "warn" | "fail";

export type GroupBy = "domains" | "files";

export interface CheckResult {
  status: Severity;
  message?: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  main?: string;
  module?: string;
  exports?: unknown;
  files?: string[];
  repository?: unknown;
  type?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  bin?: unknown;
  bugs?: unknown;
  homepage?: string;
  engines?: Record<string, string>;
  sideEffects?: boolean | string[];
}

export interface CheckContext {
  targetPath: string;
  fileExists(relPath: string): boolean;
  readFile(relPath: string): string | null;
  readJson<T = unknown>(relPath: string): T | null;
  packageJson: PackageJson | null;
}

export interface Rule {
  id: string;
  domain: string;
  group: string;
  description: string;
  severity: RuleSeverity;
  check: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}

export interface Template {
  name: string;
  description: string;
  rules: Rule[];
}

export interface RuleResult {
  id: string;
  domain: string;
  group: string;
  description: string;
  severity: RuleSeverity;
  status: Severity;
  message?: string;
}

export interface ConformConfig {
  template: string;
}

export interface ConformOutput {
  template: string;
  path: string;
  groupBy?: GroupBy;
  results: RuleResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}
