import { biome } from "./biome.ts";
import { bun } from "./bun.ts";
import { docs } from "./docs.ts";
import { github } from "./github.ts";
import { gitignore } from "./gitignore.ts";
import { husky } from "./husky.ts";
import { packageJson } from "./package_json.ts";
import { tsconfig_json } from "./tsconfig_json.ts";
import { zed } from "./zed.ts";

const allBuiltinPlugins = [
  packageJson,
  biome,
  tsconfig_json,
  husky,
  docs,
  gitignore,
  github,
  zed,
  bun,
] as const;

export type AllBuiltinPlugins = typeof allBuiltinPlugins;
