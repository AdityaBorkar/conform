import { definePreset } from "@/api/index.ts";
import { biome } from "@/plugins/biome.ts";
import { bun } from "@/plugins/bun.ts";
import { docs } from "@/plugins/docs.ts";
import { github } from "@/plugins/github.ts";
import { gitignore } from "@/plugins/gitignore.ts";
import { husky } from "@/plugins/husky.ts";
import { packageJson } from "@/plugins/package_json.ts";
import { tsconfig_json } from "@/plugins/tsconfig_json.ts";
import { zed } from "@/plugins/zed.ts";

export default definePreset([
  packageJson,
  biome,
  tsconfig_json,
  husky,
  docs,
  gitignore,
  github,
  zed,
  bun,
] as const)({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  rules: {
    "gitignore/excludes": {
      file_expressions: ["node_modules", ".env*", "*.env", "*.gen.ts"],
    },
    "husky/hook": {
      hooks: [
        { contains: "bun run format", file: ".husky/pre-commit" },
        { contains: 'bun commitlint --edit "$1"', file: ".husky/commit-msg" },
      ],
    },
    "package-json/required-fields": {
      fields: [
        "license",
        "name",
        "author",
        "contributors",
        "repository",
        "publishConfig",
        "homepage",
        "files",
        "bugs",
        "description",
        "keywords",
        "engines",
      ],
    },
  },
});
