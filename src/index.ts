export {
  defineConfig,
  definePlugin,
  defineRule as rule,
  defineTemplate,
  Plugin,
  RuleSet,
  Status,
} from "@/api/index.ts";

export type {
  CheckResult,
  ConformConfig,
  ConformOutput,
  GroupBy,
  PackageJson,
  Plugin as PluginType,
  Rule,
  RuleConfig,
  RuleOverrides,
  RuleResult,
  RuleSeverity,
  Severity,
  Template,
} from "./types.ts";
