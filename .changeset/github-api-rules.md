---
"@adistack/conform": minor
---

Add GitHub settings rules to the `github` plugin that verify repository configuration through the GitHub REST/GraphQL API using the `CONFORM_GITHUB_API_TOKEN` environment variable (admin read access required): CODEOWNERS validation, PR check status on the default branch, immutable releases, default branch (`stable`), social preview, core feature toggles (issues/wiki/discussions/projects), merge/squash/rebase/auto-merge strategy, head branch deletion, web sign-off, Actions policy (allowed actions, SHA pinning, artifact/log retention, fork PR approval, workflow token permissions), deployment environments, and Advanced Security (private vulnerability reporting, dependency graph, Dependabot alerts, secret protection, push protection). Settings without an API equivalent are surfaced by a dedicated `manual-settings` rule. Missing tokens or unresolvable owner/repo identities fail; owner/repo can be overridden per rule via params.
