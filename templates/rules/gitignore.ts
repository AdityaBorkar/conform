import { RuleSet, Status } from "@/conform-api/index.ts";
import { fileExists, readFile } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";

const _gitignore = new RuleSet<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
}>({
  context: (targetPath) => ({
    fileExists: (path: string) => fileExists(targetPath, path),
    readFile: (path: string) => readFile(targetPath, path),
  }),
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "gitignore",
});

_gitignore.defineRule({
  id: "exists",
  name: ".gitignore exists",
  test({ context }) {
    if (context.fileExists(".gitignore")) {
      return Status.pass();
    }
    return Status.fail(".gitignore not found");
  },
});

_gitignore.defineRule({
  id: "node-modules",
  name: '.gitignore contains "node_modules"',
  test({ context }) {
    const gitignore = context.readFile(".gitignore");
    if (!gitignore) {
      return Status.pass(".gitignore not found — skipping content check");
    }
    if (gitignore.includes("node_modules")) {
      return Status.pass();
    }
    return Status.fail(
      '.gitignore does not include "node_modules" — accidentally committing it is catastrophic',
    );
  },
});

_gitignore.defineRule({
  id: "env",
  name: '.gitignore contains ".env"',
  test({ context }) {
    const gitignore = context.readFile(".gitignore");
    if (!gitignore) {
      return Status.pass(".gitignore not found — skipping content check");
    }
    if (/^\.env/m.test(gitignore) || /\.env\*/m.test(gitignore)) {
      return Status.pass();
    }
    return Status.fail(
      '.gitignore does not include ".env" — secrets must never be committed',
    );
  },
});

export const gitignore = _gitignore;
