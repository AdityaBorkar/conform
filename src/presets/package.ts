import { definePreset } from "@/api/index.ts";
import { bin } from "@/inbuilt-plugins/bin.ts";
import { biome } from "@/inbuilt-plugins/biome.ts";
import { docs } from "@/inbuilt-plugins/docs.ts";
import { files } from "@/inbuilt-plugins/files.ts";
import { github } from "@/inbuilt-plugins/github.ts";
import { githubConfig } from "@/inbuilt-plugins/github-config.ts";
import { gitignore } from "@/inbuilt-plugins/gitignore.ts";
import { husky } from "@/inbuilt-plugins/husky.ts";
import { jsr } from "@/inbuilt-plugins/jsr.ts";
import { packageJson } from "@/inbuilt-plugins/package_json.ts";
import { scripts } from "@/inbuilt-plugins/scripts.ts";
import { testing } from "@/inbuilt-plugins/testing.ts";
import { tsconfig } from "@/inbuilt-plugins/tsconfig.ts";

export default definePreset({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  plugins: [
    packageJson,
    biome,
    tsconfig,
    husky,
    scripts,
    bin,
    testing,
    jsr,
    docs,
    gitignore,
    github,
    githubConfig,
    files,
  ],
  // rules can be overridden per-template or per-project (oxc-style):
  // rules: {
  //   "biome:dev-deps": "error",
  //   "package-json:files-or-npmignore": "warn",
  //   "package-json:no-install-hooks": "off",
  //   // with options (future): "biome:template": ["warn", { url: "..." }]
  // },
});
