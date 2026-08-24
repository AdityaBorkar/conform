import { RuleSet, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

const _gitignore = new RuleSet<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
}>({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "gitignore",
});

_gitignore.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
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
  domain: DOMAIN.DEV_ENVIRONMENT,
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
  domain: DOMAIN.DEV_ENVIRONMENT,
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
