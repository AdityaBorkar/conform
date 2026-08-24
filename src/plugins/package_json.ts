import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
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

export const packageJson = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
  }),
  id: "package-json",
})
  .defineRule({
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
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "entry-point",
    name: "main, module, or exports entry defined",
    params: type({
      fields: "string[]",
    }),
    test({ context, params }) {
      const pkg = context.packageJson();
      const fields = params?.fields ?? ["main", "module", "exports"];
      const entries = fields.filter((f) =>
        isDefined((pkg as Record<string, unknown> | null)?.[f]),
      );
      if (entries.length > 0) {
        return Status.pass(entries.join(", "));
      }
      return Status.fail(`no ${fields.join(", ")} field defined`);
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "build-script",
    name: "scripts.prepare or scripts.build exists",
    params: type({
      scripts: "string[]",
    }),
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.scripts ?? ["prepare", "build"];
      const found = candidates.find((s) => scripts[s]);
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`no ${candidates.join(" or ")} script found`);
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "files-or-npmignore",
    name: "files field or .npmignore exists",
    params: type({
      file_expressions: "string[]",
    }),
    test({ context, params }) {
      if (context.packageJson()?.files) {
        return Status.pass("files field defined");
      }
      const candidates = params?.file_expressions ?? [".npmignore"];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(`${found} exists`);
      }
      return Status.warn(`no files field or ${candidates.join(" or ")} found`);
    },
  })
  .defineRule({
    domain: DOMAIN.SECURITY,
    id: "no-install-hooks",
    name: "no preinstall/postinstall/install lifecycle scripts",
    params: type({
      scripts: "string[]",
    }),
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const dangerous = params?.scripts ?? [
        "preinstall",
        "postinstall",
        "install",
      ];
      const found = dangerous.filter((name) => scripts[name]);
      if (found.length > 0) {
        return Status.fail(
          `install lifecycle scripts found: ${found.join(", ")} — these are the #1 supply chain attack vector in npm`,
        );
      }
      return Status.pass();
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "required-fields",
    name: "required package.json fields are defined",
    params: type({
      fields: "string[]",
    }),
    test({ context, params }) {
      const pkg = context.packageJson();
      if (!pkg) {
        return Status.fail("package.json not found");
      }
      const fields = params?.fields ?? [...DEFAULT_REQUIRED_PACKAGE_FIELDS];
      const missing = fields.filter(
        (field) => !isDefined((pkg as Record<string, unknown>)[field]),
      );
      if (missing.length > 0) {
        return Status.fail(`missing required fields: ${missing.join(", ")}`);
      }
      return Status.pass(`all required fields present: ${fields.join(", ")}`);
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "typecheck",
    name: "typecheck script exists",
    params: type({
      scripts: "string[]",
    }),
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.scripts ?? [
        "typecheck",
        "check:types",
        "types",
      ];
      const found = candidates.find((s) => scripts[s]);
      if (found) {
        return Status.pass(scripts[found] as string);
      }
      return Status.warn(
        `no ${candidates.join(" or ")} script found — add a typecheck or check:types script running tsc --noEmit`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    id: "no-prepublish",
    name: "deprecated prepublish script is not used",
    params: type({
      scripts: "string[]",
    }),
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.scripts ?? ["prepublish"];
      const found = candidates.find((s) => scripts[s]);
      if (found) {
        return Status.fail(
          `"${found}" script is deprecated — it runs on both "npm install" and "npm publish". Use prepublishOnly instead.`,
        );
      }
      return Status.pass();
    },
  });
