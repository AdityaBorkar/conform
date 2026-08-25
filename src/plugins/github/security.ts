import { Status } from "@/api/index.ts";
import type { Plugin } from "@/api/plugin.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import {
  describeApiFailure,
  githubApi,
  judgeExpectations,
  loadRepository,
  repoPath,
  resolveApiGate,
} from "./api.ts";
import type { GithubPluginContext } from "./context.ts";
import { githubApiScopeSchema } from "./schemas.ts";

const HTTP_NOT_FOUND = 404;
const HTTP_NO_CONTENT = 204;

/** Adds the Advanced Security rules to the github plugin. */
export function withSecurityRules<M extends Record<string, unknown>>(
  plugin: Plugin<"github", GithubPluginContext, M>,
) {
  return plugin
    .defineRule({
      domain: DOMAIN.SECURITY,
      id: "private-vulnerability-reporting",
      name: "Private vulnerability reporting enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const what = "Private vulnerability reporting";
        const gate = resolveApiGate(context, what, params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{ enabled: boolean }>(
          repoPath(gate.gate.identity, "/private-vulnerability-reporting"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(describeApiFailure(what, response));
        }
        if (response.data.enabled) {
          return Status.pass("private vulnerability reporting is enabled");
        }
        return Status.fail(
          "private vulnerability reporting is disabled — enable under Settings → Advanced Security",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.SECURITY,
      id: "dependency-graph",
      name: "Dependency graph and automatic dependency submission enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Dependency graph", params);
        if (!gate.ok) {
          return gate.result;
        }
        // Repository-level enablement is only surfaced through the attached
        // code security configuration; standalone repos must be verified
        // manually.
        const response = await githubApi<{
          configuration?: {
            dependency_graph?: string;
            dependency_graph_autosubmit_action?: string;
          };
        }>(
          repoPath(gate.gate.identity, "/code-security-configuration"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(
            `${describeApiFailure("Dependency graph", response)} — if this repository is not attached to an organization code security configuration, verify Dependency graph + automatic submission manually under Settings → Advanced Security`,
          );
        }
        const configuration = response.data.configuration ?? {};
        return judgeExpectations([
          {
            actual: configuration.dependency_graph ?? "(not set)",
            label: 'dependency graph is "enabled"',
            ok: configuration.dependency_graph === "enabled",
          },
          {
            actual:
              configuration.dependency_graph_autosubmit_action ?? "(not set)",
            label: 'automatic dependency submission is "enabled"',
            ok: configuration.dependency_graph_autosubmit_action === "enabled",
          },
        ]);
      },
    })
    .defineRule({
      domain: DOMAIN.SECURITY,
      id: "dependabot-alerts",
      name: "Dependabot alerts enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Dependabot alerts", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<Record<string, never>>(
          repoPath(gate.gate.identity, "/vulnerability-alerts"),
          gate.gate.token,
        );
        if (response.ok) {
          if (response.status === HTTP_NO_CONTENT) {
            return Status.pass("Dependabot alerts are enabled");
          }
          return Status.fail(
            `Dependabot alerts: unexpected GitHub API response (HTTP ${response.status})`,
          );
        }
        if (response.status === HTTP_NOT_FOUND) {
          return Status.fail(
            "Dependabot alerts are disabled — enable under Settings → Advanced Security → Dependabot",
          );
        }
        return Status.fail(describeApiFailure("Dependabot alerts", response));
      },
    })
    .defineRule({
      domain: DOMAIN.SECURITY,
      id: "secret-protection",
      name: "Secret Protection (secret scanning) enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Secret protection", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Secret protection");
        if (!repository.ok) {
          return repository.result;
        }
        const status =
          repository.data.security_and_analysis?.secret_scanning?.status;
        if (status === "enabled") {
          return Status.pass("secret scanning is enabled");
        }
        return Status.fail(
          `secret scanning is ${status ?? "unavailable (admin token required to read security_and_analysis)"} — enable under Settings → Advanced Security → Secret Protection`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.SECURITY,
      id: "push-protection",
      name: "Push protection enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Push protection", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Push protection");
        if (!repository.ok) {
          return repository.result;
        }
        const status =
          repository.data.security_and_analysis?.secret_scanning_push_protection
            ?.status;
        if (status === "enabled") {
          return Status.pass("push protection is enabled");
        }
        return Status.fail(
          `push protection is ${status ?? "unavailable (admin token required to read security_and_analysis)"} — enable under Settings → Advanced Security → Secret Protection → Push protection`,
        );
      },
    });
}
