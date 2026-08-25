import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const tsconfigCompilerOptionsSchema = type({
  compilerOptions: "Record<string, unknown>",
});

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
    files: ["tsconfig.json"],
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
    files: ["tsconfig.json"],
    id: "compiler-options",
    name: "tsconfig.json compilerOptions matches expected config",
    params: tsconfigCompilerOptionsSchema,
    test({ context, params }) {
      const content = context.readJson<{
        compilerOptions?: Record<string, unknown>;
      }>("tsconfig.json");
      if (!content?.compilerOptions) {
        return Status.fail("tsconfig.json missing compilerOptions");
      }

      const expected = params?.compilerOptions ?? {};

      const diffs: string[] = [];

      for (const [key, expectedValue] of Object.entries(expected)) {
        const actualValue = content.compilerOptions[key];
        if (!isEqual(actualValue, expectedValue)) {
          diffs.push(
            `"${key}": expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`,
          );
        }
      }

      const extraKeys = Object.keys(content.compilerOptions).filter(
        (k) => !(k in expected),
      );
      if (extraKeys.length > 0) {
        diffs.push(`unexpected compilerOptions: ${extraKeys.join(", ")}`);
      }

      if (diffs.length > 0) {
        return Status.fail(`tsconfig drift: ${diffs.join("; ")}`);
      }

      return Status.pass(
        `all compilerOptions match: ${Object.keys(expected).join(", ")}`,
      );
    },
  });
