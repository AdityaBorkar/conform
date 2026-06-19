import { resolve } from "node:path";
import { loadConfig } from "../config/load.ts";
import { createCheckContext } from "../context.ts";
import { runChecks } from "../engine/index.ts";
import { resolveTemplate } from "../registry.ts";
import { renderJson } from "../reporter/json.ts";
import { renderTui } from "../reporter/tui.ts";

export async function CheckCommand({
	path,
	json,
	verbose,
}: {
	path: string;
	json: boolean;
	verbose: boolean;
}) {
	const targetPath = resolve(path);

	const config = await loadConfig(targetPath);
	if (!config) {
		console.error(`Error: no conform.config.ts found in ${targetPath}`);
		console.error(
			"Create one with: export default { template: 'npm-publish' };",
		);
		process.exit(2);
	}

	const template = await resolveTemplate(config.template);
	if (!template) {
		console.error(`Error: template "${config.template}" not found`);
		process.exit(2);
	}

	const ctx = createCheckContext(targetPath);
	const results = await runChecks(template, ctx);

	console.log(
		json
			? renderJson(template.name, targetPath, results, { verbose })
			: renderTui(template.name, results, { verbose }),
	);

	const hasFail = results.some((r) => r.status === "fail");
	const hasWarn = results.some((r) => r.status === "warn");

	if (hasFail) {
		process.exit(1);
	}
	if (hasWarn) {
		process.exit(2);
	}
	process.exit(0);
}
