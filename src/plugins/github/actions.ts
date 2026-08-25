import { Status } from "@/api/index.ts";
import type { Plugin } from "@/api/plugin.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import {
  describeApiFailure,
  githubApi,
  judgeExpectations,
  repoPath,
  resolveApiGate,
} from "./api.ts";
import type { GithubPluginContext } from "./context.ts";
import { githubApiScopeSchema, githubRetentionSchema } from "./schemas.ts";

const DEFAULT_RETENTION_DAYS = 90;

/** Adds the GitHub Actions settings rules to the github plugin. */
export function withActionsRules<M extends Record<string, unknown>>(
  plugin: Plugin<"github", GithubPluginContext, M>,
) {
  return plugin
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "actions-policy",
      name: "GitHub Actions enabled for all actions and reusable workflows",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Actions policy", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{
          allowed_actions?: string;
          enabled?: boolean;
        }>(
          repoPath(gate.gate.identity, "/actions/permissions"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(describeApiFailure("Actions policy", response));
        }
        return judgeExpectations([
          {
            actual: String(response.data.enabled),
            label: "Actions enabled",
            ok: response.data.enabled === true,
          },
          {
            actual: response.data.allowed_actions ?? "(unreported)",
            label: 'all actions and reusable workflows allowed ("all")',
            ok: response.data.allowed_actions === "all",
          },
        ]);
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "actions-sha-pinning",
      name: "Actions required to be pinned to a full-length commit SHA",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "SHA pinning", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{ sha_pinning_required?: boolean }>(
          repoPath(gate.gate.identity, "/actions/permissions"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(describeApiFailure("SHA pinning", response));
        }
        if (response.data.sha_pinning_required === true) {
          return Status.pass("SHA pinning is required");
        }
        return Status.fail(
          "SHA pinning is off — enable under Settings → Actions → General → Actions permissions → Require actions to be pinned to a full length commit SHA",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "actions-retention",
      name: "Artifact and log retention ≥ 90 days",
      params: githubRetentionSchema,
      async test({ context, params }) {
        const expectedDays = params?.days ?? DEFAULT_RETENTION_DAYS;
        const gate = resolveApiGate(context, "Artifact/log retention", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{ days?: number }>(
          repoPath(
            gate.gate.identity,
            "/actions/permissions/artifact-and-log-retention",
          ),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(
            describeApiFailure("Artifact/log retention", response),
          );
        }
        const actualDays = response.data.days;
        if (typeof actualDays === "number" && actualDays >= expectedDays) {
          return Status.pass(`retention is ${actualDays} day(s)`);
        }
        return Status.fail(
          `artifact/log retention is ${String(actualDays)} day(s) — expected at least ${expectedDays} (Settings → Actions → General → Artifact and log retention)`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "actions-fork-approval",
      name: "Approval required for all external contributors",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Fork PR approval", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{ approval_policy?: string }>(
          repoPath(
            gate.gate.identity,
            "/actions/permissions/fork-pr-contributor-approval",
          ),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(describeApiFailure("Fork PR approval", response));
        }
        if (response.data.approval_policy === "all_external_contributors") {
          return Status.pass(
            "workflows from external contributors require approval",
          );
        }
        return Status.fail(
          `fork PR approval policy is "${response.data.approval_policy ?? "(unreported)"}" — expected "Require approval for all external contributors" (Settings → Actions → General → Fork pull request workflows)`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "actions-workflow-permissions",
      name: "Workflow GITHUB_TOKEN read-only and cannot approve PRs",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Workflow permissions", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{
          can_approve_pull_request_reviews?: boolean;
          default_workflow_permissions?: string;
        }>(
          repoPath(gate.gate.identity, "/actions/permissions/workflow"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(
            describeApiFailure("Workflow permissions", response),
          );
        }
        return judgeExpectations([
          {
            actual:
              response.data.default_workflow_permissions ?? "(unreported)",
            label: 'default workflow permissions are "read"',
            ok: response.data.default_workflow_permissions === "read",
          },
          {
            actual: String(response.data.can_approve_pull_request_reviews),
            label: "Actions cannot create/approve pull requests",
            ok: response.data.can_approve_pull_request_reviews === false,
          },
        ]);
      },
    });
}
