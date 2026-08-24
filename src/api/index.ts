export { DOMAIN } from "@/plugins/utils/domain.ts";
export type {
  ConformConfig,
  Plugin as PluginInterface,
  Preset,
  RuleConfig,
  RuleLevel,
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
