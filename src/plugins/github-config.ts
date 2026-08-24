import { RuleSet } from "@/api/index.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import type { Target } from "@/utils/fs.ts";

const _githubConfig = new RuleSet({
  context: (_target: Target) => ({}),
  domain: DOMAIN.GITHUB_CONFIG,
  id: "github-config",
});

export const githubConfig = _githubConfig;
