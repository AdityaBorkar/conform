import { definePlugin } from "@/api/index.ts";
import { withActionsRules } from "./github/actions.ts";
import { createGithubContext } from "./github/context.ts";
import { withGeneralRules } from "./github/general.ts";
import { withReviewRules } from "./github/review.ts";
import { withSecurityRules } from "./github/security.ts";
import { withWorkflowRules } from "./github/workflows.ts";

export {
  githubApiScopeSchema,
  githubCodeownersSchema,
  githubDefaultBranchSchema,
  githubEnvironmentsSchema,
  githubPrChecksSchema,
  githubRetentionSchema,
  githubWorkflowContentSchema,
  githubWorkflowSchema,
} from "./github/schemas.ts";

/**
 * GitHub configuration plugin. Local workflow rules always run; the
 * settings rules query the GitHub REST/GraphQL API using the
 * `CONFORM_GITHUB_API_TOKEN` environment variable (admin read access
 * required). Missing tokens or unresolvable owner/repo identities fail.
 */
export const github = withSecurityRules(
  withActionsRules(
    withGeneralRules(
      withReviewRules(
        withWorkflowRules(
          definePlugin({ context: createGithubContext, id: "github" }),
        ),
      ),
    ),
  ),
);
