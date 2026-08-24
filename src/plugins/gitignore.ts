import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const gitignore = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
  id: "gitignore",
})
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "exists",
    name: ".gitignore exists",
    test({ context }) {
      if (context.fileExists(".gitignore")) {
        return Status.pass();
      }
      return Status.fail(".gitignore not found");
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    id: "excludes",
    name: ".gitignore contains exclusion paths",
    params: type({
      file_expressions: "string[]",
    }),
    test({ context, params }) {
      const content = context.readFile(".gitignore");
      if (!content) {
        return Status.pass(".gitignore not found — skipping content check");
      }
      const excludes = params?.file_expressions ?? [];
      const missing = excludes.filter((p) => !content.includes(p));
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
