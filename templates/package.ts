import { defineTemplate } from "@/conform-api/index.ts";

import { bin } from "./rules/bin.ts";
import { biome } from "./rules/biome.ts";
import { docs } from "./rules/docs.ts";
import { files } from "./rules/files.ts";
import { github } from "./rules/github.ts";
import { githubConfig } from "./rules/github-config.ts";
import { gitignore } from "./rules/gitignore.ts";
import { husky } from "./rules/husky.ts";
import { jsr } from "./rules/jsr.ts";
import { packageJson } from "./rules/package_json.ts";
import { scripts } from "./rules/scripts.ts";
import { testing } from "./rules/testing.ts";
import { tsconfig } from "./rules/tsconfig.ts";

export default defineTemplate({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  rules: [
    ...packageJson.rules,
    ...biome.rules,
    ...tsconfig.rules,
    ...husky.rules,
    ...scripts.rules,
    ...bin.rules,
    ...testing.rules,
    ...jsr.rules,
    ...docs.rules,
    ...gitignore.rules,
    ...github.rules,
    ...githubConfig.rules,
    ...files.rules,
  ],
});
