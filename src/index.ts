export {
  defineConfig,
  definePlugin,
  definePreset,
  Plugin,
  Status,
} from "@/api/index.ts";
export { DOMAIN } from "@/plugins/utils/domain.ts";
export { createTarget, Target } from "@/utils/fs.ts";
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
  RuleLevel,
  RuleOverrides,
  RuleResult,
  Severity,
} from "./types.ts";
