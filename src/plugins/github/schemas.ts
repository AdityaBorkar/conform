import { type } from "arktype";

export const githubWorkflowSchema = type({
  file_expressions: "string[]",
});

export const githubWorkflowContentSchema = type({
  contains: "string[]",
  file_expressions: "string[]",
});

/** Owner/repo override shared by every API-backed rule. */
export const githubApiScopeSchema = type({
  owner: "string?",
  repo: "string?",
});

export const githubCodeownersSchema = type({
  file_expressions: "string[]?",
});

export const githubPrChecksSchema = type({
  required_checks: "string[]?",
});

export const githubDefaultBranchSchema = type({
  branch: "string?",
});

export const githubEnvironmentsSchema = type({
  environments: "string[]?",
});

export const githubRetentionSchema = type({
  days: "number?",
});
