import { resolve } from "node:path";
import process from "node:process";

import { loadConfig } from "@/config/load.ts";
import { resolver } from "@/conform-api/resolver.ts";
import { runChecks } from "@/engine/index.ts";
import { createTarget } from "@/target.ts";

export async function CheckCommand({
  path,
  json,
  verbose: _verbose,
  group,
}: {
  path: string;
  json: boolean;
  verbose: boolean;
  group: string | undefined;
}) {
  if (json && group !== undefined) {
    process.stderr.write(
      "Error: --group is not supported with --json output.\n",
    );
    process.exit(1);
  }

  const targetPath = resolve(path);

  const config = await loadConfig(targetPath);
  if (!config) {
    process.exit(2);
  }

  const template = await resolver(config.template);
  if (!template) {
    process.exit(2);
  }

  const target = createTarget(targetPath);
  const results = await runChecks(template, target);

  const hasFail = results.some((r) => r.status === "fail");
  const hasWarn = results.some((r) => r.status === "warn");

  if (hasFail) {
    process.exit(1);
  }
  if (hasWarn) {
    process.exit(2);
  }
  process.exit(0);
}
