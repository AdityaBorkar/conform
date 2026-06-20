import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";
import { fileExists, packageJson, readFile } from "@/utils/fs.ts";

import { getBinPaths } from "./utils/bin.ts";
import { DOMAIN } from "./utils/domain.ts";

const _bin = new RuleSet<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
  readFile: (path: string) => string | null;
}>({
  context: (targetPath) => ({
    fileExists: (path: string) => fileExists(targetPath, path),
    packageJson: () => packageJson(targetPath),
    readFile: (path: string) => readFile(targetPath, path),
  }),
  domain: DOMAIN.BUILD,
  id: "bin",
});

_bin.defineRule({
  id: "file-exists",
  name: "bin field references files that exist",
  test({ context }) {
    const binPaths = getBinPaths(context.packageJson() ?? {});
    if (binPaths.length === 0) {
      return Status.pass("no bin field — skipping bin file check");
    }
    const missing = binPaths.filter((p) => !context.fileExists(p));
    if (missing.length > 0) {
      return Status.fail(
        `bin path(s) not found on disk: ${missing.join(", ")}`,
      );
    }
    return Status.pass();
  },
});

_bin.defineRule({
  id: "shebang",
  name: "bin entry files have a shebang line",
  test({ context }) {
    const binPaths = getBinPaths(context.packageJson() ?? {});
    if (binPaths.length === 0) {
      return Status.pass("no bin field — skipping shebang check");
    }
    const missingShebang: string[] = [];
    for (const binPath of binPaths) {
      const content = context.readFile(binPath);
      if (content === null) {
        continue;
      }
      const [firstLine] = content.split("\n");
      if (!firstLine?.startsWith("#!")) {
        missingShebang.push(binPath);
      }
    }
    if (missingShebang.length > 0) {
      return Status.fail(
        `bin file(s) missing shebang (#!/usr/bin/env node or bun): ${missingShebang.join(", ")}`,
      );
    }
    return Status.pass();
  },
});

export const bin = _bin;
