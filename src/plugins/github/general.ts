import { Status } from "@/api/index.ts";
import type { Plugin } from "@/api/plugin.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import {
  describeApiFailure,
  type Expectation,
  githubApi,
  judgeExpectations,
  loadRepository,
  repoPath,
  resolveApiGate,
  unavailableField,
} from "./api.ts";
import type { GithubPluginContext } from "./context.ts";
import {
  githubApiScopeSchema,
  githubDefaultBranchSchema,
  githubEnvironmentsSchema,
} from "./schemas.ts";

const SOCIAL_PREVIEW_IMAGE_HOST = "repository-images.githubusercontent.com";

const DEFAULT_BRANCH = "stable";

async function fetchSocialPreviewImageUrl(gate: {
  identity: { owner: string; repo: string };
  token: string;
}): Promise<string | null> {
  // No REST endpoint exposes the social preview; the GraphQL
  // openGraphImageUrl falls back to the owner avatar until a custom image is
  // uploaded, which makes it usable as an "image exists" probe.
  const query =
    "query($owner:String!$name:String!){repository(owner:$owner,name:$name){openGraphImageUrl}}";
  const response = await githubApi<{
    data?: { repository?: { openGraphImageUrl?: string } };
    errors?: unknown;
  }>("/graphql", gate.token, {
    body: JSON.stringify({
      query,
      variables: { name: gate.identity.repo, owner: gate.identity.owner },
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    return null;
  }
  if (response.data.errors) {
    return null;
  }
  const imageUrl = response.data.data?.repository?.openGraphImageUrl;
  return typeof imageUrl === "string" ? imageUrl : null;
}

function repositoryExpectations(data: {
  allow_merge_commit?: boolean;
  merge_commit_message?: string;
  merge_commit_title?: string;
}): Expectation[] {
  return [
    {
      actual: String(data.allow_merge_commit),
      label: "merge commits allowed",
      ok: data.allow_merge_commit === true,
    },
    {
      actual: data.merge_commit_title ?? unavailableField(),
      label: 'merge commit title defaults to "PR_TITLE"',
      ok: data.merge_commit_title === "PR_TITLE",
    },
    {
      actual: data.merge_commit_message ?? unavailableField(),
      label: 'merge commit message defaults to "PR_BODY"',
      ok: data.merge_commit_message === "PR_BODY",
    },
  ];
}

/** Adds the General-settings rules to the github plugin. */
export function withGeneralRules<M extends Record<string, unknown>>(
  plugin: Plugin<"github", GithubPluginContext, M>,
) {
  return plugin
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "releases-immutable",
      name: "Immutable releases enabled (assets/tags locked after publishing)",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Immutable releases", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{ enabled: boolean }>(
          repoPath(gate.gate.identity, "/immutable-releases"),
          gate.gate.token,
        );
        if (!response.ok) {
          return Status.fail(
            describeApiFailure("Immutable releases", response),
          );
        }
        if (response.data.enabled) {
          return Status.pass("immutable releases are enabled");
        }
        return Status.fail(
          "immutable releases are disabled — enable under Settings → General → Releases so assets/tags cannot be modified after publishing",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "default-branch",
      name: "Default branch",
      params: githubDefaultBranchSchema,
      async test({ context, params }) {
        const expected = params?.branch ?? DEFAULT_BRANCH;
        const gate = resolveApiGate(context, "Default branch", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Default branch");
        if (!repository.ok) {
          return repository.result;
        }
        const actual = repository.data.default_branch ?? "";
        if (actual === expected) {
          return Status.pass(`default branch is "${expected}"`);
        }
        return Status.fail(
          `default branch is "${actual}" — expected "${expected}"`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "social-preview",
      name: "Social preview image uploaded",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Social preview", params);
        if (!gate.ok) {
          return gate.result;
        }
        const imageUrl = await fetchSocialPreviewImageUrl(gate.gate);
        if (imageUrl === null) {
          return Status.fail(
            "Social preview: could not read openGraphImageUrl via the GitHub GraphQL API — verify the token and try again",
          );
        }
        if (imageUrl.includes(SOCIAL_PREVIEW_IMAGE_HOST)) {
          return Status.pass("social preview image is set");
        }
        return Status.fail(
          "no social preview image uploaded — Settings → General → Social preview → Upload an image (uploading is not possible via API)",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "core-features",
      name: "Issues/PRs on; wiki/discussions/projects off",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Core features", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Core features");
        if (!repository.ok) {
          return repository.result;
        }
        const { data } = repository;
        const expectations: Expectation[] = [
          {
            actual: String(data.has_issues),
            label: "issues enabled",
            ok: data.has_issues === true,
          },
          {
            actual: String(data.has_wiki),
            label: "wiki disabled",
            ok: data.has_wiki === false,
          },
          {
            actual: String(data.has_discussions),
            label: "discussions disabled",
            ok: data.has_discussions === false,
          },
          {
            actual: String(data.has_projects),
            label: "projects disabled",
            ok: data.has_projects === false,
          },
        ];
        if (typeof data.has_pull_requests === "boolean") {
          expectations.push({
            actual: String(data.has_pull_requests),
            label: "pull requests enabled",
            ok: data.has_pull_requests === true,
          });
        }
        return judgeExpectations(expectations);
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "issue-and-pr-templates",
      name: "Issue templates and PR template exist",
      test({ context }) {
        const problems: string[] = [];
        const hasIssueTemplates =
          context.fileExists(".github/ISSUE_TEMPLATE.md") ||
          context
            .listFiles(".github/ISSUE_TEMPLATE")
            .some((file) => /\.(md|ya?ml)$/i.test(file));
        const hasPrTemplate =
          [
            ".github/PULL_REQUEST_TEMPLATE.md",
            ".github/pull_request_template.md",
          ].some((p) => context.fileExists(p)) ||
          context
            .listFiles(".github/pull_request_template")
            .some((file) => /\.md$/i.test(file));
        if (!hasIssueTemplates) {
          problems.push(
            "no issue templates (.github/ISSUE_TEMPLATE/*.md|yml) — set them up via Settings → General → Issues → Templates",
          );
        }
        if (!hasPrTemplate) {
          problems.push("no PR template (.github/pull_request_template.md)");
        }
        if (problems.length === 0) {
          return Status.pass("issue templates and PR template present");
        }
        return Status.fail(problems.join("; "));
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "merge-commit-strategy",
      name: "Merge commits allowed with PR title & description",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Merge commit strategy", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(
          gate.gate,
          "Merge commit strategy",
        );
        if (!repository.ok) {
          return repository.result;
        }
        return judgeExpectations(repositoryExpectations(repository.data));
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "squash-merge-strategy",
      name: "Squash merging allowed with PR title & description",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Squash merge strategy", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(
          gate.gate,
          "Squash merge strategy",
        );
        if (!repository.ok) {
          return repository.result;
        }
        const { data } = repository;
        return judgeExpectations([
          {
            actual: String(data.allow_squash_merge),
            label: "squash merging allowed",
            ok: data.allow_squash_merge === true,
          },
          {
            actual: data.squash_merge_commit_title ?? unavailableField(),
            label: 'squash commit title defaults to "PR_TITLE"',
            ok: data.squash_merge_commit_title === "PR_TITLE",
          },
          {
            actual: data.squash_merge_commit_message ?? unavailableField(),
            label: 'squash commit message defaults to "PR_BODY"',
            ok: data.squash_merge_commit_message === "PR_BODY",
          },
        ]);
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "rebase-merge-disabled",
      name: "Rebase merging disabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Rebase merging", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Rebase merging");
        if (!repository.ok) {
          return repository.result;
        }
        const actual = repository.data.allow_rebase_merge;
        if (actual === false) {
          return Status.pass("rebase merging is disabled");
        }
        return Status.fail(
          `rebase merging is ${actual === undefined ? unavailableField() : "enabled"} — disable under Settings → General → Pull Requests`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "auto-merge-enabled",
      name: "Auto-merge enabled",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Auto-merge", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(gate.gate, "Auto-merge");
        if (!repository.ok) {
          return repository.result;
        }
        if (repository.data.allow_auto_merge === true) {
          return Status.pass("auto-merge is enabled");
        }
        return Status.fail(
          "auto-merge is disabled — enable under Settings → General → Pull Requests → Allow auto-merge",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "delete-head-branches",
      name: "Head branches automatically deleted after merge",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Delete head branches", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(
          gate.gate,
          "Delete head branches",
        );
        if (!repository.ok) {
          return repository.result;
        }
        if (repository.data.delete_branch_on_merge === true) {
          return Status.pass("head branches are deleted automatically");
        }
        return Status.fail(
          "automatic head branch deletion is off — enable under Settings → General → Pull Requests",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "web-signoff-not-required",
      name: "Sign-off not required for web-based commits",
      params: githubApiScopeSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "Web commit sign-off", params);
        if (!gate.ok) {
          return gate.result;
        }
        const repository = await loadRepository(
          gate.gate,
          "Web commit sign-off",
        );
        if (!repository.ok) {
          return repository.result;
        }
        if (repository.data.web_commit_signoff_required === false) {
          return Status.pass("sign-off is not required for web-based commits");
        }
        return Status.fail(
          "contributors are required to sign off on web-based commits — disable under Settings → General → Pull Requests",
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "environments",
      name: "Required deployment environments exist",
      params: githubEnvironmentsSchema,
      async test({ context, params }) {
        const required = params?.environments ?? ["stable", "beta"];
        const gate = resolveApiGate(context, "Environments", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await githubApi<{
          environments?: { name?: string }[];
        }>(repoPath(gate.gate.identity, "/environments"), gate.gate.token);
        if (!response.ok) {
          return Status.fail(describeApiFailure("Environments", response));
        }
        const existing = (response.data.environments ?? [])
          .map((environment) => environment.name)
          .filter((name): name is string => typeof name === "string");
        const missing = required.filter(
          (name) => !existing.some((candidate) => candidate === name),
        );
        if (missing.length === 0) {
          return Status.pass(`environments present: ${required.join(", ")}`);
        }
        return Status.fail(
          `missing environment(s): ${missing.join(", ")} — found ${existing.join(", ") || "none"} (Settings → Environments → New environment)`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "manual-settings",
      name: "Settings only configurable in the GitHub UI (verify manually)",
      test() {
        const unverifiable = [
          "auto-close issues with merged linked PRs (Settings → General)",
          "disable comments on individual commits (Settings → General)",
          "exclude Git LFS objects from archives (Settings → General)",
          "limit branches/tags updated in a single push (Settings → General → Pushes)",
          "limit code review to explicitly granted users (Settings → General → Code review limits)",
          "Copilot Autofix disabled (Settings → Advanced Security)",
          "OIDC immutable subject claim (Actions → General → OIDC)",
          "agent suggestions for issues = Full Control (Settings → Planning)",
        ];
        return Status.fail(
          `the following settings have no GitHub REST/GraphQL API and must be verified manually: ${unverifiable.join("; ")}`,
        );
      },
    });
}
