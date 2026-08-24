import { RuleSet } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";

const _githubConfig = new RuleSet({
  context: (_target: Target) => ({}),
  id: "github-config",
});

export const githubConfig = _githubConfig;
