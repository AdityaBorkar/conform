export {
  defineConfig,
  definePlugin,
  definePreset,
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
  Preset,
  Rule,
  RuleConfig,
  RuleOverrides,
  RuleResult,
  RuleSeverity,
  Severity,
  Template,
} from "./types.ts";
