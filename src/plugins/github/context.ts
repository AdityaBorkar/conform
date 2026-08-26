import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Target } from "@/utils/fs.ts";

/**
 * GitHub owner/repo identity for the checked-out target repository.
 */
export interface RepoIdentity {
  owner: string;
  repo: string;
}

function parseGithubUrl(url: string): RepoIdentity | null {
  const match = url.match(/github\.com[/:]([^/:]+)\/([^/#?]+?)(?:\.git)?\/?$/i);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!(owner && repo)) {
    return null;
  }
  return { owner, repo };
}

function repoIdentityFromTarget(target: Target): RepoIdentity | null {
  const pkg = target.readJson<{ repository?: unknown }>("package.json");
  const rawRepository = pkg?.repository;
  const repositoryUrl =
    typeof rawRepository === "string"
      ? rawRepository
      : (rawRepository as { url?: string } | null)?.url;
  if (typeof repositoryUrl === "string") {
    const identity = parseGithubUrl(repositoryUrl);
    if (identity) {
      return identity;
    }
  }

  const gitConfig = target.readFile(".git/config");
  if (gitConfig) {
    const originMatch = gitConfig.match(
      /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/,
    );
    const originUrl = originMatch?.[1];
    if (originUrl) {
      const identity = parseGithubUrl(originUrl);
      if (identity) {
        return identity;
      }
    }
  }

  return null;
}

/**
 * Context handed to every `github` plugin rule: local filesystem access plus
 * lazily-resolved GitHub repository identity.
 */
export interface GithubPluginContext {
  fileExists: (path: string) => boolean;
  getRepoIdentity: () => RepoIdentity | null;
  listFiles: (dir: string) => string[];
  readFile: (path: string) => string | null;
}

export function createGithubContext(target: Target): GithubPluginContext {
  return {
    fileExists: (path: string) => target.fileExists(path),
    getRepoIdentity: () => repoIdentityFromTarget(target),
    listFiles: (dir: string) => {
      try {
        return readdirSync(join(target.path, dir));
      } catch {
        return [];
      }
    },
    readFile: (path: string) => target.readFile(path),
  };
}
