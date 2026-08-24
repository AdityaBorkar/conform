export { DOMAIN } from "@/plugins/utils/domain.ts";
export type {
  ConformConfig,
  HuskyHookSpec,
  Plugin as PluginInterface,
  Preset,
  RequiredFieldsParams,
  RuleConfig,
  RuleOverrides,
  RuleRegistry,
  StrictRuleOverrides,
} from "@/types.ts";
export { Target } from "@/utils/fs.ts";
export { defineConfig } from "./config.ts";
export { definePlugin, Plugin } from "./plugin.ts";
export {
  definePreset,
  presetResolver,
} from "./preset.ts";
export { Status } from "./status.ts";
