import { type } from "arktype";

import { Plugin, Status } from "@/api/index.ts";
import type { PackageJson } from "@/types.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";
import {
  DEFAULT_REQUIRED_PACKAGE_FIELDS,
  isDefined,
  summarize,
} from "./utils/package.ts";

const requiredStructure = type({
  bugs: "unknown",
  license: "string",
  name: "string",
  type: "'module'",
  version: "string",
});

const recommendedStructure = type({
  description: "string",
  engines: "Record<string, string>",
  homepage: "string",
  repository: "unknown",
  sideEffects: "boolean | string[]",
});

const _packageJson = new Plugin<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
}>({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.BUILD,
  id: "package-json",
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "structure",
  name: "package.json structure: required & recommended fields",
  test({ context }) {
    const pkg = context.packageJson();
    if (!pkg) {
      return Status.fail("package.json not found");
    }

    const required = requiredStructure(pkg);
    if (required instanceof type.errors) {
      return Status.fail(summarize(required));
    }

    const recommended = recommendedStructure(required);
    if (recommended instanceof type.errors) {
      return Status.warn(summarize(recommended));
    }

    return Status.pass();
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "entry-point",
  name: "main, module, or exports entry defined",
  test({ context }) {
    const pkg = context.packageJson();
    const entries = [
      pkg?.main && "main",
      pkg?.module && "module",
      pkg?.exports && "exports",
    ].filter(Boolean);
    if (entries.length > 0) {
      return Status.pass(entries.join(", "));
    }
    return Status.fail("no main, module, or exports field defined");
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "build-script",
  name: "scripts.prepare or scripts.build exists",
  test({ context }) {
    const scripts = context.packageJson()?.scripts;
    if (scripts?.["prepare"]) {
      return Status.pass("prepare");
    }
    if (scripts?.["build"]) {
      return Status.pass("build");
    }
    return Status.fail("no prepare or build script found");
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "files-or-npmignore",
  name: "files field or .npmignore exists",
  test({ context }) {
    if (context.packageJson()?.files) {
      return Status.pass("files field defined");
    }
    if (context.fileExists(".npmignore")) {
      return Status.pass(".npmignore exists");
    }
    return Status.warn("no files field or .npmignore found");
  },
});

_packageJson.defineRule({
  domain: DOMAIN.SECURITY,
  id: "no-install-hooks",
  name: "no preinstall/postinstall/install lifecycle scripts",
  test({ context }) {
    const scripts = context.packageJson()?.scripts;
    const dangerousScripts = ["preinstall", "postinstall", "install"];
    const found: string[] = [];
    for (const name of dangerousScripts) {
      if (scripts?.[name]) {
        found.push(name);
      }
    }
    if (found.length > 0) {
      return Status.fail(
        `install lifecycle scripts found: ${found.join(", ")} — these are the #1 supply chain attack vector in npm`,
      );
    }
    return Status.pass();
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "required-fields",
  name: "required package.json fields are defined",
  params: type("string[]").or(type({ fields: "string[]" })),
  test({ context, params }) {
    const pkg = context.packageJson();
    if (!pkg) {
      return Status.fail("package.json not found");
    }
    const fields: string[] = (() => {
      if (!params) {
        return [...DEFAULT_REQUIRED_PACKAGE_FIELDS];
      }
      if (Array.isArray(params)) {
        return params as string[];
      }
      return (params as { fields: string[] }).fields;
    })();
    const missing = fields.filter(
      (field) => !isDefined((pkg as Record<string, unknown>)[field]),
    );
    if (missing.length > 0) {
      return Status.fail(`missing required fields: ${missing.join(", ")}`);
    }
    return Status.pass(`all required fields present: ${fields.join(", ")}`);
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "typecheck",
  name: "typecheck script exists",
  test({ context }) {
    const scripts = context.packageJson()?.scripts ?? {};
    const typecheckScript =
      scripts["typecheck"] ?? scripts["check:types"] ?? scripts["types"];
    if (typecheckScript) {
      return Status.pass(typecheckScript);
    }
    return Status.warn(
      "no typecheck script found — add a typecheck or check:types script running tsc --noEmit",
    );
  },
});

_packageJson.defineRule({
  domain: DOMAIN.BUILD,
  id: "no-prepublish",
  name: "deprecated prepublish script is not used",
  test({ context }) {
    const scripts = context.packageJson()?.scripts;
    if (scripts?.["prepublish"]) {
      return Status.fail(
        'prepublish script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.',
      );
    }
    return Status.pass();
  },
});

export const packageJson = _packageJson;
