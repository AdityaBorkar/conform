import { biome } from "./biome.ts";
import { docs } from "./docs.ts";
import { github } from "./github.ts";
import { gitignore } from "./gitignore.ts";
import { husky } from "./husky.ts";
import { packageJson } from "./package_json.ts";
import { tsconfig_json } from "./tsconfig_json.ts";

const allBuiltinPlugins = [
  packageJson,
  biome,
  tsconfig_json,
  husky,
  docs,
  gitignore,
  github,
] as const;

export type AllBuiltinPlugins = typeof allBuiltinPlugins;
