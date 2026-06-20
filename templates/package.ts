import { defineTemplate } from "@/conform-api/index.ts";

import { binRules } from "./rules/bin.ts";
import { biomeRules } from "./rules/biome.ts";
import { docsRules } from "./rules/docs.ts";
import { filesRules } from "./rules/files.ts";
import { githubRules } from "./rules/github.ts";
import { gitignoreRules } from "./rules/gitignore.ts";
import { huskyRules } from "./rules/husky.ts";
import { jsrRules } from "./rules/jsr.ts";
import { packageJsonRules } from "./rules/package_json.ts";
import { scriptsRules } from "./rules/scripts.ts";
import { testingRules } from "./rules/testing.ts";
import { tsconfigRules } from "./rules/tsconfig.ts";

export default defineTemplate({
  description: "Conformance rules for publishing an NPM package",
  name: "npm-publish",
  rules: [
    ...packageJsonRules,
    ...biomeRules,
    ...tsconfigRules,
    ...huskyRules,
    ...scriptsRules,
    ...binRules,
    ...testingRules,
    ...jsrRules,
    ...docsRules,
    ...gitignoreRules,
    ...githubRules,
    ...filesRules,
  ],
});
