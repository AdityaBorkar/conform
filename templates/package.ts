import { defineTemplate } from "@/conform-api/index.ts";

import { binRules as bin } from "./rules/bin.ts";
import { biomeRules as biome } from "./rules/biome.ts";
import { docsRules as docs } from "./rules/docs.ts";
import { filesRules as files } from "./rules/files.ts";
import { githubRules as github } from "./rules/github.ts";
import { gitignoreRules as gitignore } from "./rules/gitignore.ts";
import { husky } from "./rules/husky.ts";
import { jsrRules as jsr } from "./rules/jsr.ts";
import { packageJsonRules as packageJson } from "./rules/package_json.ts";
import { scriptsRules as scripts } from "./rules/scripts.ts";
import { testingRules as testing } from "./rules/testing.ts";
import { tsconfigRules as tsconfig } from "./rules/tsconfig.ts";

export default defineTemplate({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  rules: [
    ...packageJson,
    ...biome,
    ...tsconfig,
    ...husky.rules,
    ...scripts,
    ...bin,
    ...testing,
    ...jsr,
    ...docs,
    ...gitignore,
    ...github,
    ...files,
  ],
});
