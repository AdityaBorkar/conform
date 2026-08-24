import type { Plugin as PluginInterface, Rule, Template } from "@/types.ts";

export function defineTemplate(template: Template): Template {
  return template;
}

// Legacy overload: previously Template used `rules: Rule[]`. Now it uses
// `plugins: Plugin[]` plus an optional `rules` override map (oxc-style).
// For backwards compatibility, if a template is passed with a `rules` array
// of `Rule` objects (old shape), we adapt it to a synthetic plugin.
export function defineTemplateLegacy(
  template: Template | { description: string; name: string; rules: Rule[] },
): Template {
  if ("plugins" in template && Array.isArray((template as Template).plugins)) {
    return template as Template;
  }
  if (
    "rules" in template &&
    Array.isArray((template as { rules: unknown[] }).rules)
  ) {
    const legacy = template as {
      description: string;
      name: string;
      rules: Rule[];
    };
    // Check if legacy rules are Rule[] (have check) vs RuleOverrides map
    const first = legacy.rules[0] as unknown as Rule | undefined;
    if (first && typeof first.check === "function") {
      const syntheticPlugin: PluginInterface = {
        id: "legacy",
        rules: legacy.rules,
      };
      return {
        description: legacy.description,
        name: legacy.name,
        plugins: [syntheticPlugin],
      };
    }
  }
  return template as Template;
}
