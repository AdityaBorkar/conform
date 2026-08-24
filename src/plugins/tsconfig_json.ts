import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const tsconfigOptionsSchema = type({
  "options?": "Record<string, unknown>",
  "warnOptions?": "Record<string, unknown>",
});

export const tsconfig_json = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
    readJson: <T = unknown>(path: string) => target.readJson<T>(path),
  }),
  id: "typescript",
})
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "deps",
    name: "typescript in devDependencies or peerDependencies",
    test({ context }) {
      const version =
        context.packageJson()?.devDependencies?.["typescript"] ??
        context.packageJson()?.peerDependencies?.["typescript"];
      if (version) {
        return Status.pass(version);
      }
      return Status.fail(
        "typescript not found in devDependencies or peerDependencies",
      );
    },
  })
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "tsconfig",
    name: "tsconfig.json exists",
    test({ context }) {
      if (context.fileExists("tsconfig.json")) {
        return Status.pass();
      }
      return Status.fail("tsconfig.json not found");
    },
  })
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "compiler-options",
    name: "compilerOptions in tsconfig",
    params: tsconfigOptionsSchema,
    test({ context, params }) {
      const content = context.readJson<{
        compilerOptions?: Record<string, unknown>;
      }>("tsconfig.json");
      if (!content?.compilerOptions) {
        return Status.pass(
          "no tsconfig.json found — skipping compilerOptions check",
        );
      }

      const options = params?.options ?? {};
      const warnOptions = params?.warnOptions ?? {};

      const effectiveWarn: Record<string, unknown> = { ...warnOptions };
      if (content.compilerOptions["noEmit"] === true) {
        effectiveWarn["sourceMap"] = undefined;
      }

      const missing = Object.entries(options).filter(
        ([k, v]) => content.compilerOptions?.[k] !== v,
      );
      if (missing.length > 0) {
        const details = missing
          .map(([k, v]) => {
            if (k === "strict") {
              return `"${k}: ${String(v)}" — strict mode not enabled`;
            }
            if (k === "noUncheckedIndexedAccess") {
              return `"${k}: ${String(v)}" — array/object index access should return T | undefined`;
            }
            if (k === "isolatedModules") {
              return `"${k}: ${String(v)}" — required for Bun, esbuild, and SWC`;
            }
            return `"${k}: ${String(v)}"`;
          })
          .join("; ");
        return Status.fail(`tsconfig missing compilerOptions: ${details}`);
      }

      const warnMissing = Object.entries(effectiveWarn).filter(
        ([k, v]) => content.compilerOptions?.[k] !== v,
      );
      if (warnMissing.length > 0) {
        const details = warnMissing
          .map(([k, v]) => {
            if (k === "verbatimModuleSyntax") {
              return `"${k}: ${String(v)}" — prevents CJS/ESM mismatches`;
            }
            if (k === "sourceMap") {
              return `"${k}: ${String(v)}" — without source maps, production stack traces are nearly impossible to debug`;
            }
            return `"${k}: ${String(v)}"`;
          })
          .join("; ");
        return Status.warn(`tsconfig missing compilerOptions: ${details}`);
      }

      const all = { ...options, ...effectiveWarn };
      return Status.pass(
        `all compilerOptions present: ${Object.keys(all).join(", ")}`,
      );
    },
  });
