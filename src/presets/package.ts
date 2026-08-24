import { definePreset } from "@/api/index.ts";
import { biome } from "@/plugins/biome.ts";
import { docs } from "@/plugins/docs.ts";
import { github } from "@/plugins/github.ts";
import { gitignore } from "@/plugins/gitignore.ts";
import { husky } from "@/plugins/husky.ts";
import { packageJson } from "@/plugins/package_json.ts";
import { tsconfig } from "@/plugins/tsconfig.ts";

export default definePreset({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  plugins: [packageJson, biome, tsconfig, husky, docs, gitignore, github],
  rules: {
    "gitignore:excludes": {
      level: "error",
      params: { file_expressions: ["node_modules", ".env"] },
    },
    "husky:hook": {
      level: "error",
      params: {
        hooks: [
          { contains: "bun run format", file: ".husky/pre-commit" },
          { contains: 'bun commitlint --edit "$1"', file: ".husky/commit-msg" },
        ],
      },
    },
    "package-json:required-fields": {
      level: "error",
      params: {
        fields: ["license", "name", "author", "contributors", "repository"],
      },
    },
  },
});
