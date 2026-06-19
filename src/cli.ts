#!/usr/bin/env bun
import { resolve } from "node:path";
import { loadConfig } from "./config.ts";
import { createCheckContext } from "./context.ts";
import { runChecks } from "./engine.ts";
import { resolveTemplate } from "./registry.ts";
import { renderJson } from "./reporter/json.ts";
import { renderTui } from "./reporter/tui.ts";

function printUsage(): void {
	console.log(`@adityab/conform — repository conformance checker

Usage:
  conform check [--path <dir>] [--json]

Commands:
  check    Run conformance checks

Options:
  --path   Target directory (default: current working directory)
  --json   Output results as JSON
  --help   Show this help message`);
}

function parseArgs(args: string[]): {
	command: string | null;
	targetPath: string;
	jsonOutput: boolean;
} {
	let command: string | null = null;
	let targetPath = process.cwd();
	let jsonOutput = false;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--help" || args[i] === "-h") {
			printUsage();
			process.exit(0);
		}
		if (args[i] === "--path" && i + 1 < args.length) {
			targetPath = resolve(args[i + 1] ?? ".");
			i++;
		} else if (args[i] === "--json") {
			jsonOutput = true;
		} else if (!args[i]?.startsWith("-") && !command) {
			command = args[i] ?? null;
		}
	}

	return { command, targetPath, jsonOutput };
}

async function main(): Promise<void> {
	const { command, targetPath, jsonOutput } = parseArgs(process.argv.slice(2));

	if (command !== "check") {
		printUsage();
		process.exit(2);
	}

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

	if (jsonOutput) {
		console.log(renderJson(template.name, targetPath, results));
	} else {
		console.log(renderTui(template.name, results));
	}

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

main();
