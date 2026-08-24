import { resolve } from "node:path";
import process from "node:process";

import { check } from "@/api/conformance.ts";
import type { GroupBy } from "@/types.ts";

export async function CheckCommand({
  path,
  json,
  verbose,
  group,
}: {
  group: string | undefined;
  json: boolean;
  path: string;
  verbose: boolean;
}) {
  if (json && group !== undefined) {
    process.stderr.write(
      "Error: --group is not supported with --json output.\n",
    );
    process.exit(1);
  }

  const targetPath = resolve(path);

  const result = await check(targetPath, {
    ...(group ? { groupBy: group as GroupBy } : {}),
    json,
    verbose,
  });

  if ("error" in result) {
    if (result.error === "no-config") {
      process.stderr.write(
        `Error: No conform.config.ts found in ${targetPath}\n`,
      );
    } else {
      process.stderr.write(`Error: ${result.message}\n`);
    }
    process.exit(2);
  }

  process.stdout.write(`${result.rendered}\n`);

  if (result.hasFail) {
    process.exit(1);
  }
  if (result.hasWarn) {
    process.exit(2);
  }
  process.exit(0);
}
