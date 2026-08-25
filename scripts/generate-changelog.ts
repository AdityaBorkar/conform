#!/usr/bin/env bun

/**
 * Generate a changeset + CHANGELOG.md entry from commits between base...head.
 *
 * Called from `.github/workflows/changelog.yml` or locally:
 *   bun run scripts/generate-changelog.ts --base origin/stable --head HEAD
 *   bun run scripts/generate-changelog.ts --base main --head HEAD --dry-run
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
// biome-ignore lint/correctness/noUnresolvedImports: bun provides $
import { $ } from "bun";

const CHANGELOG_SNIPPET_LEN = 80;
const CHANGELOG_PREVIEW_LEN = 1000;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: "string" },
    "dry-run": { default: false, type: "boolean" },
    head: { default: "HEAD", type: "string" },
    help: { default: false, short: "h", type: "boolean" },
  },
});

if (values.help) {
  console.log(`
Usage: bun run scripts/generate-changelog.ts [options]

Options:
  --base <ref>     Base ref (PR target, e.g. origin/stable). Falls back to latest tag
  --head <ref>     Head ref (default: HEAD)
  --dry-run        Print without writing files
  -h, --help       Show help
`);
  process.exit(0);
}

const base: string | undefined = values.base;
const head: string = values.head ?? "HEAD";
const dryRun: boolean = values["dry-run"] ?? false;

async function resolveBase(): Promise<string | null> {
  if (base) {
    const exists = await $`git rev-parse --verify ${base}`.nothrow().quiet();
    if (exists.exitCode === 0) {
      return base;
    }
    console.warn(
      `[generate-changelog] base ref "${base}" not found, falling back`,
    );
  }
  const tag = await $`git describe --tags --abbrev=0`.nothrow().quiet();
  if (tag.exitCode === 0) {
    return tag.text().trim();
  }
  return null;
}

async function getCommits(from: string | null, to: string): Promise<string[]> {
  const range = from ? `${from}..${to}` : to;
  const log = await $`git log ${range} --pretty=format:%s%n%b%x1e --no-merges`
    .nothrow()
    .quiet();
  if (log.exitCode !== 0 || !log.text().trim()) {
    return [];
  }
  return log
    .text()
    .split("\x1e")
    .map((s) => s.trim())
    .filter(Boolean);
}

function inferBump(commits: string[]): "major" | "minor" | "patch" {
  const text = commits.join("\n").toLowerCase();
  if (
    text.includes("breaking change") ||
    commits.some((c) => c.includes("!:"))
  ) {
    return "major";
  }
  if (commits.some((c) => c.toLowerCase().startsWith("feat"))) {
    return "minor";
  }
  return "patch";
}

function groupCommits(commits: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    Features: [],
    Fixes: [],
    Other: [],
  };
  for (const raw of commits) {
    const line = raw.split("\n")[0]?.trim() ?? raw.trim();
    if (!line) {
      continue;
    }
    const lower = line.toLowerCase();
    if (lower.startsWith("feat")) {
      groups["Features"]?.push(line);
    } else if (lower.startsWith("fix")) {
      groups["Fixes"]?.push(line);
    } else {
      groups["Other"]?.push(line);
    }
  }
  return groups;
}

function formatFallbackNotes(commits: string[]): string {
  if (commits.length === 0) {
    return "- No notable changes.";
  }
  const groups = groupCommits(commits);
  const lines: string[] = [];
  for (const [heading, entries] of Object.entries(groups)) {
    if (entries.length === 0) {
      continue;
    }
    lines.push(`### ${heading}`);
    for (const entry of entries) {
      lines.push(`- ${entry}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

async function tryOpencode2(commits: string[]): Promise<string | null> {
  const hasCreds = Boolean(
    process.env["ANTHROPIC_API_KEY"] ||
      process.env["OPENAI_API_KEY"] ||
      process.env["GITHUB_TOKEN"] ||
      process.env["OPENCODE_API_KEY"],
  );
  if (!hasCreds) {
    console.log(
      "[generate-changelog] no LLM credentials, using fallback formatter",
    );
    return null;
  }

  const commitBlock = commits.join("\n---\n");
  const prompt = [
    "You are a changelog generator. Summarize the following conventional commits",
    "into a Keep a Changelog entry for end-users (slightly technical).",
    "Group by Features / Fixes / Other, rewrite each commit as a user-facing bullet",
    "(outcome-focused, not just technical). Keep it short, no hallucinations.",
    "Return ONLY markdown bullets grouped by ### headings, no preamble.",
    "",
    "<commits>",
    commitBlock,
    "</commits>",
  ].join("\n");

  try {
    console.log("[generate-changelog] invoking opencode2...");
    const tmp = `/tmp/opencode-changelog-prompt-${Date.now()}.md`;
    writeFileSync(tmp, prompt);
    const out =
      await $`opencode2 run --auto --format json --file ${tmp} "Generate the changelog section for these commits. Output markdown only."`.nothrow();
    if (out.exitCode !== 0) {
      console.warn(
        `[generate-changelog] opencode2 exited ${out.exitCode}: ${out.stderr.toString().slice(0, CHANGELOG_PREVIEW_LEN)}`,
      );
      return null;
    }
    let text = out.text().trim();
    try {
      const parsed = JSON.parse(text) as {
        content?: string;
        message?: string;
        text?: string;
      };
      if (Array.isArray(parsed)) {
        text = (parsed as unknown as string[]).join("\n");
      } else {
        text = parsed.content ?? parsed.message ?? parsed.text ?? text;
      }
    } catch {
      // not JSON, use raw
    }
    if (!text) {
      return null;
    }
    console.log(
      `[generate-changelog] opencode2 output:\n${text.slice(0, CHANGELOG_PREVIEW_LEN)}`,
    );
    return text.trim();
  } catch (err) {
    console.warn(
      `[generate-changelog] opencode2 invocation failed: ${String(err)}`,
    );
    return null;
  }
}

function ensureChangesetDir(): void {
  if (!existsSync(".changeset")) {
    mkdirSync(".changeset", { recursive: true });
  }
}

function writeChangeset(bump: string, notesText: string): string {
  ensureChangesetDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const filename = join(".changeset", `${id}.md`);
  const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
    name: string;
  };
  const frontmatter = `---\n"${pkg.name}": ${bump}\n---\n`;
  const content = `${frontmatter}\n${notesText}\n`;
  if (!dryRun) {
    writeFileSync(filename, content);
  }
  console.log(
    `[generate-changelog] ${dryRun ? "[dry-run] would write" : "wrote"} ${filename} (${bump})`,
  );
  return filename;
}

function updateChangelog(entryNotes: string): void {
  const file = "CHANGELOG.md";
  let existing = "";
  if (existsSync(file)) {
    existing = readFileSync(file, "utf-8");
  } else {
    existing = "# @adistack/conform\n\n## Unreleased\n\n";
  }

  if (!existing.includes("## Unreleased")) {
    existing = existing.replace(/^# .+\n/, (m) => `${m}\n## Unreleased\n\n`);
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const entry = `## Unreleased\n\n_${timestamp}_\n\n${entryNotes}\n`;
  if (existing.includes(entryNotes.trim().slice(0, CHANGELOG_SNIPPET_LEN))) {
    console.log(
      "[generate-changelog] CHANGELOG already contains these notes, skipping prepend",
    );
    return;
  }
  const updated = existing.replace("## Unreleased", entry);
  if (!dryRun) {
    writeFileSync(file, updated);
  }
  console.log(
    `[generate-changelog] ${dryRun ? "[dry-run] would update" : "updated"} ${file}`,
  );
}

// --- main ---
const from = await resolveBase();
console.log(`[generate-changelog] range: ${from ?? "(all)"}..${head}`);

const commits = await getCommits(from, head);
console.log(`[generate-changelog] found ${commits.length} commit(s)`);
if (commits.length === 0) {
  console.log("[generate-changelog] no commits to summarize, exiting 0");
  process.exit(0);
}
for (const commit of commits.slice(0, 20)) {
  console.log(`  - ${commit.split("\n")[0]}`);
}

const aiNotes = await tryOpencode2(commits);
const finalNotes = aiNotes ?? formatFallbackNotes(commits);

const bump = inferBump(commits);
console.log(`[generate-changelog] inferred bump: ${bump}`);
console.log(`[generate-changelog] notes:\n${finalNotes}\n`);

writeChangeset(bump, finalNotes);
updateChangelog(finalNotes);

console.log("[generate-changelog] done.");
