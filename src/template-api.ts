import type {
	CheckContext,
	CheckResult,
	ConformConfig,
	Rule,
	RuleSeverity,
	Template,
} from "./types.ts";

export function defineTemplate(template: Template): Template {
	return template;
}

export function rule(def: {
	id: string;
	group: string;
	description: string;
	severity: RuleSeverity;
	check: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}): Rule {
	return def;
}

export function defineConfig(config: ConformConfig): ConformConfig {
	return config;
}
