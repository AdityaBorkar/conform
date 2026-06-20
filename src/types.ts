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

export interface Target {
  fileExists: (relPath: string) => boolean;
  packageJson: () => PackageJson | null;
  readFile: (relPath: string) => string | null;
  readJson: <T = unknown>(relPath: string) => T | null;
  targetPath: string;
}

export interface Rule {
  check: (ctx: Target) => CheckResult | Promise<CheckResult>;
  description: string;
  domain: string;
  files: string[];
  id: string;
}

export interface Template {
  description: string;
  name: string;
  rules: Rule[];
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
  template: string;
}

export interface ConformOutput {
  groupBy?: GroupBy;
  path: string;
  results: RuleResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  template: string;
}
