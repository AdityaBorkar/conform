import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

const _biome = new RuleSet<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
}>({
  context: (target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.STYLE,
  id: "biome",
});

_biome.defineRule({
  id: "dev-deps",
  name: "@biomejs/biome in devDependencies",
  test({ context }) {
    const version = context.packageJson()?.devDependencies?.["@biomejs/biome"];
    if (version) {
      return Status.pass(version);
    }
    return Status.fail("@biomejs/biome not found in devDependencies");
  },
});

_biome.defineRule({
  id: "config-file",
  name: "biome.json or biome.jsonc exists",
  test({ context }) {
    if (context.fileExists("biome.json")) {
      return Status.pass("biome.json");
    }
    if (context.fileExists("biome.jsonc")) {
      return Status.pass("biome.jsonc");
    }
    return Status.warn("no biome.json or biome.jsonc found");
  },
});

_biome.defineRule({
  id: "lint-script",
  name: "lint or check script runs biome",
  test({ context }) {
    const scripts = context.packageJson()?.scripts ?? {};
    const lintScript = scripts["lint"] ?? scripts["check"];
    if (typeof lintScript === "string" && lintScript.includes("biome")) {
      return Status.pass(lintScript);
    }
    return Status.fail("no script running biome check/lint found");
  },
});

_biome.defineRule({
  id: "format-script",
  name: "format script runs biome",
  test({ context }) {
    const scripts = context.packageJson()?.scripts ?? {};
    const formatScript =
      scripts["format"] ?? scripts["check:format"] ?? scripts["check:lint"];
    if (typeof formatScript === "string" && formatScript.includes("biome")) {
      return Status.pass(formatScript);
    }
    return Status.warn(
      "no format script running biome format found — add a format script to enforce consistent style",
    );
  },
});

export const biome = _biome;
