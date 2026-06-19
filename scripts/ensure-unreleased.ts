import { readFileSync, writeFileSync } from "node:fs";

const changelogPath = new URL("../CHANGELOG.md", import.meta.url).pathname;

let content: string;
try {
  content = readFileSync(changelogPath, "utf8");
} catch {
  console.error("CHANGELOG.md not found");
  process.exit(1);
}

const unreleasedRe = /^## Unreleased$/m;

if (!unreleasedRe.test(content)) {
  const headerEnd = content.indexOf("\n\n");
  if (headerEnd === -1) {
    console.error("Unexpected CHANGELOG.md format");
    process.exit(1);
  }
  content =
    content.slice(0, headerEnd + 2) +
    "## Unreleased\n\n" +
    content.slice(headerEnd + 2);
  writeFileSync(changelogPath, content);
  console.log("Inserted ## Unreleased section into CHANGELOG.md");
} else {
  console.log("## Unreleased section already present in CHANGELOG.md");
}
