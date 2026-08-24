import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import type { Target } from "@/utils/fs.ts";

export const biomeConfigSchema = type({
  file_expressions: "string[]",
});

export const biomeScriptSchema = type({
  contains: "string",
  file_expressions: "string[]",
});

export const biome = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  id: "biome",
})
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "dev-deps",
    name: "@biomejs/biome in devDependencies",
    test({ context }) {
      const version =
        context.packageJson()?.devDependencies?.["@biomejs/biome"];
      if (version) {
        return Status.pass(version);
      }
      return Status.fail("@biomejs/biome not found in devDependencies");
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "config-file",
    name: "biome.json or biome.jsonc exists",
    params: biomeConfigSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "biome.json",
        "biome.jsonc",
      ];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.warn(
        `no ${candidates.join(" or ")} found — add a biome config to enforce consistent style`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "lint-script",
    name: "lint or check script runs biome",
    params: biomeScriptSchema,
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.file_expressions ?? ["lint", "check"];
      const contains = params?.contains ?? "biome";
      const matched = candidates.find(
        (name) =>
          typeof scripts[name] === "string" && scripts[name].includes(contains),
      );
      if (matched) {
        return Status.pass(scripts[matched] as string);
      }
      return Status.fail(
        `no script [${candidates.join(", ")}] running "${contains}" found`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "format-script",
    name: "format script runs biome",
    params: biomeScriptSchema,
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.file_expressions ?? [
        "format",
        "check:format",
        "check:lint",
      ];
      const contains = params?.contains ?? "biome";
      const matched = candidates.find(
        (name) =>
          typeof scripts[name] === "string" && scripts[name].includes(contains),
      );
      if (matched) {
        return Status.pass(scripts[matched] as string);
      }
      return Status.warn(
        `no format script [${candidates.join(", ")}] running "${contains}" found — add a format script to enforce consistent style`,
      );
    },
  });
