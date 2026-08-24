import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const tsconfig = definePlugin({
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
    id: "strict",
    name: "strict: true in tsconfig",
    test({ context }) {
      const tsconfig = context.readJson<{
        compilerOptions?: { strict?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.strict === true) {
        return Status.pass();
      }
      return Status.fail("strict mode not enabled in tsconfig.json");
    },
  })
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "no-unchecked-indexed-access",
    name: "noUncheckedIndexedAccess: true in tsconfig",
    test({ context }) {
      const tsconfig = context.readJson<{
        compilerOptions?: { noUncheckedIndexedAccess?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.noUncheckedIndexedAccess === true) {
        return Status.pass();
      }
      return Status.fail(
        "noUncheckedIndexedAccess is not enabled — array/object index access should return T | undefined to catch runtime errors",
      );
    },
  })
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "isolated-modules",
    name: "isolatedModules: true in tsconfig",
    test({ context }) {
      const tsconfig = context.readJson<{
        compilerOptions?: { isolatedModules?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.isolatedModules === true) {
        return Status.pass();
      }
      return Status.fail(
        "isolatedModules is not enabled — required for Bun, esbuild, and SWC which transpile files individually",
      );
    },
  })
  .defineRule({
    domain: DOMAIN.CODE_QUALITY,
    id: "verbatim-module-syntax",
    name: "verbatimModuleSyntax: true in tsconfig",
    test({ context }) {
      const tsconfig = context.readJson<{
        compilerOptions?: { verbatimModuleSyntax?: boolean };
      }>("tsconfig.json");
      if (tsconfig?.compilerOptions?.verbatimModuleSyntax === true) {
        return Status.pass();
      }
      return Status.warn(
        "verbatimModuleSyntax is not enabled — prevents CJS/ESM mismatches by preserving import/export syntax exactly",
      );
    },
  })
  .defineRule({
    domain: DOMAIN.OBSERVABILITY,
    id: "source-map",
    name: "sourceMap: true in tsconfig (when not noEmit)",
    test({ context }) {
      const tsconfig = context.readJson<{
        compilerOptions?: {
          noEmit?: boolean;
          sourceMap?: boolean;
        };
      }>("tsconfig.json");
      if (!tsconfig?.compilerOptions) {
        return Status.pass(
          "no tsconfig.json found — skipping source map check",
        );
      }
      if (tsconfig.compilerOptions.noEmit === true) {
        return Status.pass(
          "noEmit is true — source maps not applicable for raw TS publishing",
        );
      }
      if (tsconfig.compilerOptions.sourceMap === true) {
        return Status.pass();
      }
      return Status.warn(
        "sourceMap is not enabled — without source maps, production stack traces point to compiled output and are nearly impossible to debug",
      );
    },
  });
