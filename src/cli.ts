#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { CheckCommand } from "./commands/check.ts";

const pkg = JSON.parse(
	readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8"),
);

const program = new Command();

program
	.name("conform")
	.description("@adityab/conform — repository conformance checker")
	.version(pkg.version);

program
	.command("check")
	.description("Run conformance checks")
	.option("--path <dir>", "Target directory", process.cwd())
	.option("--json", "Output results as JSON")
	.option(
		"-v, --verbose",
		"Show passed checks (default: only errors and warnings)",
	)
	.action(CheckCommand);

program.parse();
