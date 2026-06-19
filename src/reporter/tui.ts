import type { RuleResult, Severity } from "../types.ts";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function icon(status: Severity): string {
	switch (status) {
		case "pass":
			return `${GREEN}✓${RESET}`;
		case "fail":
			return `${RED}✗${RESET}`;
		case "warn":
			return `${YELLOW}⚠${RESET}`;
	}
}

function shortId(id: string): string {
	const idx = id.lastIndexOf(":");
	return idx >= 0 ? id.slice(idx + 1) : id;
}

export function renderTui(
	templateName: string,
	results: RuleResult[],
	options: { verbose?: boolean } = {},
): string {
	const { verbose = false } = options;
	const visible = verbose
		? results
		: results.filter((r) => r.status !== "pass");

	const lines: string[] = [];
	lines.push(`${BOLD}@adityab/conform${RESET} — ${templateName} template`);
	lines.push("");

	const groups = new Map<string, RuleResult[]>();
	for (const result of visible) {
		const group = groups.get(result.group) ?? [];
		group.push(result);
		groups.set(result.group, group);
	}

	const maxIdLen = Math.max(...visible.map((r) => shortId(r.id).length));

	for (const [group, groupResults] of groups) {
		lines.push(group);
		for (const result of groupResults) {
			const sid = shortId(result.id).padEnd(maxIdLen);
			const msg = result.message ? `  ${DIM}${result.message}${RESET}` : "";
			lines.push(`  ${icon(result.status)} ${sid}${msg}`);
		}
		lines.push("");
	}

	const passed = results.filter((r) => r.status === "pass").length;
	const warned = results.filter((r) => r.status === "warn").length;
	const failed = results.filter((r) => r.status === "fail").length;

	lines.push("━".repeat(50));
	lines.push(
		`  ${GREEN}${passed} passed${RESET}  ·  ${YELLOW}${warned} warned${RESET}  ·  ${RED}${failed} failed${RESET}`,
	);

	return lines.join("\n");
}
