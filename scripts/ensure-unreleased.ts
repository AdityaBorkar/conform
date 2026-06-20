import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const changelogPath = new URL("../CHANGELOG.md", import.meta.url).pathname;

let content: string;
try {
  content = readFileSync(changelogPath, "utf8");
} catch {
  process.exit(1);
}

const unreleasedRe = /^## Unreleased$/m;

if (!unreleasedRe.test(content)) {
  const headerEnd = content.indexOf("\n\n");
  if (headerEnd === -1) {
    process.exit(1);
  }
  content =
    content.slice(0, headerEnd + 2) +
    "## Unreleased\n\n" +
    content.slice(headerEnd + 2);
  writeFileSync(changelogPath, content);
}
