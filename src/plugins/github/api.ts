import process from "node:process";

import { Status } from "@/api/index.ts";
import type { CheckResult } from "@/types.ts";
import type { GithubPluginContext, RepoIdentity } from "./context.ts";

// ---------------------------------------------------------------------------
// GitHub REST/GraphQL client (plain fetch, GET responses memoized for the
// CLI lifetime so multiple rules share a single /repos round-trip).
// ---------------------------------------------------------------------------

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
export const TOKEN_ENV_VAR = "CONFORM_GITHUB_API_TOKEN";

const HTTP_NETWORK_ERROR = 0;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

const API_ERROR_SNIPPET_MAX_CHARS = 300;

export interface GithubApiSuccess<T> {
  data: T;
  ok: true;
  status: number;
}

export interface GithubApiFailure {
  message: string;
  ok: false;
  status: number;
}

export type GithubApiResponse<T> = GithubApiSuccess<T> | GithubApiFailure;

const apiCache = new Map<string, GithubApiResponse<unknown>>();

async function githubApi<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<GithubApiResponse<T>> {
  const method = init?.method ?? "GET";
  const cacheKey = `${method} ${path}`;
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached as GithubApiResponse<T>;
  }

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : String(error),
      ok: false,
      status: HTTP_NETWORK_ERROR,
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      message:
        body.slice(0, API_ERROR_SNIPPET_MAX_CHARS) || response.statusText,
      ok: false,
      status: response.status,
    };
  }

  const data =
    response.status === HTTP_NO_CONTENT
      ? {}
      : ((await response.json().catch(() => ({}))) as T);
  const result: GithubApiResponse<T> = {
    data,
    ok: true,
    status: response.status,
  };
  if (method === "GET") {
    apiCache.set(cacheKey, result as GithubApiResponse<unknown>);
  }
  return result;
}

export function describeApiFailure(
  context: string,
  failure: GithubApiFailure,
): string {
  switch (failure.status) {
    case HTTP_NETWORK_ERROR:
      return `${context}: could not reach ${GITHUB_API_BASE} (${failure.message})`;
    case HTTP_UNAUTHORIZED:
      return `${context}: ${TOKEN_ENV_VAR} was rejected (HTTP ${failure.status}) — check the token`;
    case HTTP_FORBIDDEN:
      return `${context}: token lacks permission (HTTP ${failure.status}) — admin read access is required for GitHub settings`;
    case HTTP_NOT_FOUND:
      return `${context}: resource not found (HTTP ${failure.status}) — verify the repository exists and the token can see it`;
    default:
      return `${context}: GitHub API returned HTTP ${failure.status} (${failure.message})`;
  }
}

/**
 * Everything an API-backed rule needs after its guard checks pass.
 */
export interface ApiGate {
  identity: RepoIdentity;
  token: string;
}

export type ApiGateResult =
  | { gate: ApiGate; ok: true }
  | { ok: false; result: CheckResult };

export function resolveApiGate(
  context: GithubPluginContext,
  what: string,
  params?: { owner?: string; repo?: string },
): ApiGateResult {
  // biome-ignore lint/style/noProcessEnv: the GitHub token must come from the environment
  const token = process.env[TOKEN_ENV_VAR];
  if (!token) {
    return {
      ok: false,
      result: Status.fail(
        `${what}: ${TOKEN_ENV_VAR} is not set — export a GitHub token with admin read access`,
      ),
    };
  }
  const fallbackIdentity = context.getRepoIdentity();
  const owner = params?.owner ?? fallbackIdentity?.owner;
  const repo = params?.repo ?? fallbackIdentity?.repo;
  if (!(owner && repo)) {
    return {
      ok: false,
      result: Status.fail(
        `${what}: could not resolve GitHub owner/repo — add a repository field to package.json, configure a git remote, or set the "owner"/"repo" rule params`,
      ),
    };
  }
  return { gate: { identity: { owner, repo }, token }, ok: true };
}

export function repoPath(identity: RepoIdentity, suffix: string): string {
  return `/repos/${identity.owner}/${identity.repo}${suffix}`;
}

/** Minimal shape of `GET /repos/{owner}/{repo}` used by these rules. */
export interface GithubRepository {
  allow_auto_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_squash_merge?: boolean;
  default_branch?: string;
  delete_branch_on_merge?: boolean;
  has_discussions?: boolean;
  has_issues?: boolean;
  has_projects?: boolean;
  has_pull_requests?: boolean;
  has_wiki?: boolean;
  merge_commit_message?: string;
  merge_commit_title?: string;
  security_and_analysis?: {
    secret_scanning?: { status?: string };
    secret_scanning_push_protection?: { status?: string };
  } | null;
  squash_merge_commit_message?: string;
  squash_merge_commit_title?: string;
  web_commit_signoff_required?: boolean;
}

export async function loadRepository(
  gate: ApiGate,
  what: string,
): Promise<
  { data: GithubRepository; ok: true } | { ok: false; result: CheckResult }
> {
  const response = await githubApi<GithubRepository>(
    repoPath(gate.identity, ""),
    gate.token,
  );
  if (!response.ok) {
    return {
      ok: false,
      result: Status.fail(describeApiFailure(what, response)),
    };
  }
  return { data: response.data, ok: true };
}

// ---------------------------------------------------------------------------
// Shared expectation helpers for multi-field settings checks
// ---------------------------------------------------------------------------

export interface Expectation {
  actual: string;
  label: string;
  ok: boolean;
}

export function judgeExpectations(expectations: Expectation[]): CheckResult {
  const violations = expectations.filter((expectation) => !expectation.ok);
  if (violations.length === 0) {
    return Status.pass(expectations.map((item) => item.label).join(", "));
  }
  return Status.fail(
    violations
      .map((item) => `${item.label} (found: ${item.actual})`)
      .join("; "),
  );
}

export function unavailableField(hint?: string): string {
  return hint ?? "(unavailable — needs contents:write token permission)";
}

export { githubApi };
