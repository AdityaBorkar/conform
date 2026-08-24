import { type } from "arktype";

import { Plugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const DEFAULT_GITIGNORE_EXCLUDES: readonly string[] = [
  "node_modules",
  ".env",
] as const;

export function resolveGitignoreExcludes(params?: string[]): string[] {
  if (!params || params.length === 0) {
    return [...DEFAULT_GITIGNORE_EXCLUDES];
  }
  return params;
}

function isPatternPresent(content: string, pattern: string): boolean {
  if (pattern === ".env") {
    return (
      /^\.env/m.test(content) ||
      /\.env\*/m.test(content) ||
      content.includes(".env")
    );
  }
  return content.includes(pattern);
}

const _gitignore = new Plugin<{
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string | null;
}>({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
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
  id: "excludes",
  name: ".gitignore contains exclusion paths",
  params: type("string[]"),
  test({ context, params }) {
    const gitignore = context.readFile(".gitignore");
    if (!gitignore) {
      return Status.pass(".gitignore not found — skipping content check");
    }
    const excludes = resolveGitignoreExcludes(params);
    const missing = excludes.filter((p) => !isPatternPresent(gitignore, p));
    if (missing.length === 0) {
      return Status.pass(`all exclusions present: ${excludes.join(", ")}`);
    }
    const details = missing
      .map((m) => {
        if (m === "node_modules") {
          return `"${m}" — accidentally committing it is catastrophic`;
        }
        if (m === ".env") {
          return `"${m}" — secrets must never be committed`;
        }
        return `"${m}"`;
      })
      .join("; ");
    return Status.fail(`.gitignore does not include ${details}`);
  },
});

export const gitignore = _gitignore;
