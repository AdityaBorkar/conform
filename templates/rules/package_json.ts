// biome-ignore lint/correctness/noUnresolvedImports: arktype re-exports `type` via a non-standard "ark-ts" exports condition Biome cannot statically resolve; the export exists and tsc validates it
import { type } from "arktype";

import { RuleSet, Status } from "@/conform-api/index.ts";
import type { PackageJson } from "@/types.ts";

import { DOMAIN } from "./utils/domain.ts";

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

function summarize(errors: type.errors): string {
  return Object.entries(errors.flatProblemsByPath)
    .map(([field, problems]) => `${field}: ${problems.join(", ")}`)
    .join("; ");
}

const _packageJson = new RuleSet<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
}>({
  context: (target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  domain: DOMAIN.BUILD,
  id: "package-json",
});

_packageJson.defineRule({
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
  id: "build-script",
  name: "scripts.prepare or scripts.build exists",
  test({ context }) {
    const scripts = context.packageJson()?.scripts;
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    if (scripts?.["prepare"]) {
      return Status.pass("prepare");
    }
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
    if (scripts?.["build"]) {
      return Status.pass("build");
    }
    return Status.fail("no prepare or build script found");
  },
});

_packageJson.defineRule({
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

export const packageJson = _packageJson;
