import { RuleSet } from "@/conform-api/index.ts";

const _githubConfig = new RuleSet({
  context: () => ({}),
  id: "github-config",
});

export const githubConfig = _githubConfig;
