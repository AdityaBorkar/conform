import type { GroupBy, RuleResult, Severity } from "@/types.ts";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function icon(status: Severity): string {
  if (status === "pass") {
    return `${GREEN}✓${RESET}`;
  }
  if (status === "fail") {
    return `${RED}✗${RESET}`;
  }
  if (status === "warn") {
    return `${YELLOW}⚠${RESET}`;
  }
  return "";
}

function shortId(id: string): string {
  const idx = id.lastIndexOf(":");
  return idx >= 0 ? id.slice(idx + 1) : id;
}

function renderByDomains(visible: RuleResult[], maxIdLen: number): string[] {
  const lines: string[] = [];

  const domains = new Map<string, Map<string, RuleResult[]>>();
  const domainOrder: string[] = [];
  for (const result of visible) {
    let domainGroups = domains.get(result.domain);
    if (!domainGroups) {
      domainGroups = new Map();
      domains.set(result.domain, domainGroups);
      domainOrder.push(result.domain);
    }
    const group = domainGroups.get(result.group) ?? [];
    group.push(result);
    domainGroups.set(result.group, group);
  }

  for (const domainName of domainOrder) {
    const domainGroups = domains.get(domainName);
    if (!domainGroups) {
      continue;
    }

    lines.push(`${BOLD}${domainName}${RESET}`);

    for (const [group, groupResults] of domainGroups) {
      lines.push(`  ${group}`);
      for (const result of groupResults) {
        const sid = shortId(result.id).padEnd(maxIdLen);
        const msg = result.message ? `  ${DIM}${result.message}${RESET}` : "";
        lines.push(`    ${icon(result.status)} ${sid}${msg}`);
      }
    }

    lines.push("");
  }

  return lines;
}

function renderByFiles(visible: RuleResult[], maxIdLen: number): string[] {
  const lines: string[] = [];

  const groups = new Map<string, RuleResult[]>();
  const groupOrder: string[] = [];
  for (const result of visible) {
    const list = groups.get(result.group);
    if (list) {
      list.push(result);
    } else {
      groups.set(result.group, [result]);
      groupOrder.push(result.group);
    }
  }

  for (const groupName of groupOrder) {
    const groupResults = groups.get(groupName);
    if (!groupResults) {
      continue;
    }

    lines.push(`${BOLD}${groupName}${RESET}`);
    for (const result of groupResults) {
      const sid = shortId(result.id).padEnd(maxIdLen);
      const msg = result.message ? `  ${DIM}${result.message}${RESET}` : "";
      lines.push(`  ${icon(result.status)} ${sid}${msg}`);
    }

    lines.push("");
  }

  return lines;
}

export function renderTui(
  templateName: string,
  results: RuleResult[],
  options: { verbose?: boolean; groupBy?: GroupBy } = {},
): string {
  const { verbose = false, groupBy = "domains" } = options;
  const visible = verbose
    ? results
    : results.filter((r) => r.status !== "pass");

  const lines: string[] = [];
  lines.push(`${BOLD}@adityab/conform${RESET} — ${templateName} template`);
  lines.push("");

  const maxIdLen = Math.max(...visible.map((r) => shortId(r.id).length));

  const body =
    groupBy === "files"
      ? renderByFiles(visible, maxIdLen)
      : renderByDomains(visible, maxIdLen);
  lines.push(...body);

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  lines.push("━".repeat(50));
  lines.push(
    `  ${GREEN}${passed} passed${RESET}  ·  ${YELLOW}${warned} warned${RESET}  ·  ${RED}${failed} failed${RESET}`,
  );

  return lines.join("\n");
}
