import { resolve } from "node:path";
import process from "node:process";

import { loadConfig } from "@/config/load.ts";
import { resolver } from "@/conform-api/resolver.ts";
import { createCheckContext } from "@/context.ts";
import { runChecks } from "@/engine/index.ts";

export async function CheckCommand({
  path,
  //   json,
  //   verbose,
  // group,
}: {
  path: string;
  json: boolean;
  verbose: boolean;
  group: string;
}) {
  // const groupBy = group === "files" ? "files" : ("domains" as GroupBy);
  const targetPath = resolve(path);

  const config = await loadConfig(targetPath);
  if (!config) {
    process.exit(2);
  }

  const template = await resolver(config.template);
  if (!template) {
    process.exit(2);
  }

  const ctx = createCheckContext(targetPath);
  const results = await runChecks(template, ctx);

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
