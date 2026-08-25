import { Status } from "@/api/index.ts";
import type { Plugin } from "@/api/plugin.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import type { GithubPluginContext } from "./context.ts";
import {
  githubWorkflowContentSchema,
  githubWorkflowSchema,
} from "./schemas.ts";

/** Adds the local workflow/dependency-tooling rules to the github plugin. */
export function withWorkflowRules<M extends Record<string, unknown>>(
  plugin: Plugin<"github", GithubPluginContext, M>,
) {
  return plugin
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "ci-workflow",
      name: "CI workflow file exists",
      params: githubWorkflowSchema,
      test({ context, params }) {
        const candidates = params?.file_expressions ?? [
          ".github/workflows/ci.yml",
          ".github/workflows/ci.yaml",
          ".github/workflows/test.yml",
          ".github/workflows/test.yaml",
          ".github/workflows/build.yml",
          ".github/workflows/build.yaml",
          ".github/workflows/check.yml",
          ".github/workflows/check.yaml",
        ];
        const found = candidates.find((p) => context.fileExists(p));
        if (found) {
          return Status.pass(found);
        }
        return Status.fail(
          `no CI workflow found — expected ${candidates.join(", ")}`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "release-workflow",
      name: "Release/publish workflow file exists",
      params: githubWorkflowSchema,
      test({ context, params }) {
        const candidates = params?.file_expressions ?? [
          ".github/workflows/release.yml",
          ".github/workflows/release.yaml",
          ".github/workflows/publish.yml",
          ".github/workflows/publish.yaml",
          ".github/workflows/deploy.yml",
          ".github/workflows/deploy.yaml",
        ];
        const found = candidates.find((p) => context.fileExists(p));
        if (found) {
          return Status.pass(found);
        }
        return Status.warn(
          `no release/publish workflow found — expected ${candidates.join(", ")}`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "ci-lint",
      name: "CI workflow runs lint",
      params: githubWorkflowContentSchema,
      test({ context, params }) {
        const candidates = params?.file_expressions ?? [
          ".github/workflows/ci.yml",
          ".github/workflows/ci.yaml",
          ".github/workflows/test.yml",
          ".github/workflows/test.yaml",
          ".github/workflows/build.yml",
          ".github/workflows/build.yaml",
          ".github/workflows/check.yml",
          ".github/workflows/check.yaml",
        ];
        const contains = params?.contains ?? ["biome", "lint", "check:lint"];
        const ciFile = candidates.find((p) => context.fileExists(p));
        if (!ciFile) {
          return Status.pass("no CI workflow found — skipping content checks");
        }
        const content = context.readFile(ciFile);
        if (!content) {
          return Status.pass(
            "could not read CI workflow — skipping content checks",
          );
        }
        const matched = contains.find((c) => content.includes(c));
        if (matched) {
          return Status.pass(`contains "${matched}"`);
        }
        return Status.warn(
          `CI workflow does not appear to run lint — expected to contain ${contains.map((c) => `"${c}"`).join(" or ")}`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "ci-typecheck",
      name: "CI workflow runs typecheck",
      params: githubWorkflowContentSchema,
      test({ context, params }) {
        const candidates = params?.file_expressions ?? [
          ".github/workflows/ci.yml",
          ".github/workflows/ci.yaml",
          ".github/workflows/test.yml",
          ".github/workflows/test.yaml",
          ".github/workflows/build.yml",
          ".github/workflows/build.yaml",
          ".github/workflows/check.yml",
          ".github/workflows/check.yaml",
        ];
        const contains = params?.contains ?? [
          "tsc",
          "typecheck",
          "check:types",
        ];
        const ciFile = candidates.find((p) => context.fileExists(p));
        if (!ciFile) {
          return Status.pass("no CI workflow found — skipping content checks");
        }
        const content = context.readFile(ciFile);
        if (!content) {
          return Status.pass(
            "could not read CI workflow — skipping content checks",
          );
        }
        const matched = contains.find((c) => content.includes(c));
        if (matched) {
          return Status.pass(`contains "${matched}"`);
        }
        return Status.warn(
          `CI workflow does not appear to run typecheck — expected to contain ${contains.map((c) => `"${c}"`).join(" or ")}`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "dependabot",
      name: "Dependabot or Renovate config exists",
      params: githubWorkflowSchema,
      test({ context, params }) {
        const candidates = params?.file_expressions ?? [
          ".github/dependabot.yml",
          ".github/dependabot.yaml",
          "renovate.json",
          ".renovaterc",
          ".renovaterc.json",
        ];
        const found = candidates.find((p) => context.fileExists(p));
        if (found) {
          return Status.pass(found);
        }
        return Status.warn(
          `no ${candidates.join(" or ")} found — automated dependency updates prevent security drift`,
        );
      },
    });
}
