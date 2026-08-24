export type {
  Plugin as PluginInterface,
  Preset,
  RuleOverrides,
  Template,
} from "@/types.ts";

export { defineConfig } from "./config.ts";
export { definePlugin, Plugin, RuleSet } from "./plugin.ts";
export {
  definePreset,
  definePreset as defineTemplate,
  presetResolver,
  presetResolver as resolver,
} from "./preset.ts";
export { defineRule } from "./rule.ts";
export { Status } from "./status.ts";
