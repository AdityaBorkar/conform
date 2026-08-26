import { Status } from "@/api/index.ts";
import type { Plugin } from "@/api/plugin.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import type { CheckResult } from "@/types.ts";
import {
  type ApiGateResult,
  describeApiFailure,
  githubApi,
  loadRepository,
  repoPath,
  resolveApiGate,
} from "./api.ts";
import type { GithubPluginContext } from "./context.ts";
import { githubCodeownersSchema, githubPrChecksSchema } from "./schemas.ts";

const DEFAULT_CODEOWNERS_LOCATIONS = [
  ".github/CODEOWNERS",
  "docs/CODEOWNERS",
  "CODEOWNERS",
];

const MAX_LISTED_PROBLEMS = 5;

function findCodeownersFile(
  context: GithubPluginContext,
  candidates: string[],
): string | null {
  return (
    candidates.find((candidate) => {
      const content = context.readFile(candidate);
      return content !== null && content.trim().length > 0;
    }) ?? null
  );
}

interface CodeownersError {
  line?: number;
  message?: string;
  path?: string;
}

function fetchCodeownersErrors(gate: Extract<ApiGateResult, { ok: true }>) {
  return githubApi<{ errors: CodeownersError[] }>(
    repoPath(gate.gate.identity, "/codeowners/errors"),
    gate.gate.token,
  );
}

interface CheckRun {
  conclusion: string | null;
  name: string;
  status: string;
}

const NEUTRAL_CONCLUSIONS = ["skipped", "neutral"];

function collectCheckProblems(runs: CheckRun[]): string[] {
  const problems: string[] = [];
  for (const run of runs) {
    if (run.conclusion && NEUTRAL_CONCLUSIONS.includes(run.conclusion)) {
      continue;
    }
    if (run.status !== "completed") {
      problems.push(`${run.name} is ${run.status}`);
    } else if (run.conclusion !== "success") {
      problems.push(`${run.name} concluded "${run.conclusion}"`);
    }
  }
  return problems;
}

function findMissingRequiredChecks(
  runs: CheckRun[],
  requiredChecks: string[],
): string[] {
  const names = runs.map((run) => run.name.toLowerCase());
  return requiredChecks.filter(
    (required) => !names.some((name) => name.includes(required.toLowerCase())),
  );
}

async function fetchDefaultBranchCheckRuns(
  gate: Extract<ApiGateResult, { ok: true }>,
): Promise<
  | { ok: true; ref: string; runs: CheckRun[] }
  | { ok: false; result: CheckResult }
> {
  const repository = await loadRepository(gate.gate, "PR checks");
  if (!repository.ok) {
    return repository;
  }
  const ref = encodeURIComponent(repository.data.default_branch ?? "main");
  const response = await githubApi<{
    check_runs: CheckRun[];
    total_count: number;
  }>(
    repoPath(gate.gate.identity, `/commits/${ref}/check-runs`),
    gate.gate.token,
  );
  if (!response.ok) {
    return {
      ok: false,
      result: Status.fail(describeApiFailure("PR checks", response)),
    };
  }
  return { ok: true, ref, runs: response.data.check_runs ?? [] };
}

/** Adds the CODEOWNERS and PR-check rules to the github plugin. */
export function withReviewRules<M extends Record<string, unknown>>(
  plugin: Plugin<"github", GithubPluginContext, M>,
) {
  return plugin
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "codeowners",
      name: "CODEOWNERS exists and has no syntax errors",
      params: githubCodeownersSchema,
      async test({ context, params }) {
        const candidates =
          params?.file_expressions ?? DEFAULT_CODEOWNERS_LOCATIONS;
        const found = findCodeownersFile(context, candidates);
        if (!found) {
          return Status.fail(
            `no CODEOWNERS found — expected ${candidates.join(", ")}`,
          );
        }

        const gate = resolveApiGate(context, "CODEOWNERS validation", params);
        if (!gate.ok) {
          return gate.result;
        }
        const response = await fetchCodeownersErrors(gate);
        if (!response.ok) {
          return Status.fail(
            describeApiFailure("CODEOWNERS validation", response),
          );
        }
        const errors = response.data.errors ?? [];
        if (errors.length === 0) {
          return Status.pass(found);
        }
        const details = errors
          .map((error) => {
            const path = typeof error.path === "string" ? error.path : "?";
            const line = typeof error.line === "number" ? error.line : 0;
            const message =
              typeof error.message === "string" ? error.message : "unknown";
            return `${path}:${line} ${message}`;
          })
          .slice(0, MAX_LISTED_PROBLEMS)
          .join("; ");
        return Status.fail(
          `CODEOWNERS has ${errors.length} parse error(s) reported by GitHub: ${details}`,
        );
      },
    })
    .defineRule({
      domain: DOMAIN.GITHUB_CONFIG,
      id: "pr-checks",
      name: "Latest default-branch commit has all PR checks green (lint/format/typecheck/conform)",
      params: githubPrChecksSchema,
      async test({ context, params }) {
        const gate = resolveApiGate(context, "PR checks", params);
        if (!gate.ok) {
          return gate.result;
        }
        const fetched = await fetchDefaultBranchCheckRuns(gate);
        if (!fetched.ok) {
          return fetched.result;
        }

        const { ref, runs: checkRuns } = fetched;
        if (checkRuns.length === 0) {
          return Status.fail(
            `no check runs found on the latest "${ref}" commit — CI did not report lint/format/typecheck/conform results`,
          );
        }
        const problems = collectCheckProblems(checkRuns);
        if (problems.length > 0) {
          return Status.fail(
            `${problems.length} failing/pending check(s) on latest "${ref}" commit: ${problems.slice(0, MAX_LISTED_PROBLEMS).join("; ")}`,
          );
        }

        const requiredChecks = params?.required_checks ?? [];
        const missing =
          requiredChecks.length > 0
            ? findMissingRequiredChecks(checkRuns, requiredChecks)
            : [];
        if (missing.length > 0) {
          return Status.fail(
            `checks green but expected job(s) missing: ${missing.join(", ")}`,
          );
        }

        return Status.pass(
          `all ${checkRuns.length} check run(s) succeeded on latest "${ref}" commit`,
        );
      },
    });
}
