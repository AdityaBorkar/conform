# Fumadocs Shape — www/ mechanics

`www/` is a fumadocs remote source. Hold this shape exactly; the docs site renders whatever lands here.

## Pages registry

`www/meta.json` is the page order. Keep the journey order and the separators:

```json
{
  "title": "@adistack/conform",
  "description": "Me check repo. Repo good? Me say yes or no.",
  "pages": [
    "---Start---",
    "quick-start",
    "concepts",
    "configuration",
    "cli",
    "monorepo",
    "---Examples---",
    "fix-drift",
    "custom-rule",
    "---Reference---",
    "presets",
    "plugins",
    "authoring",
    "api"
  ]
}
```

- Edit `meta.json` only when adding, removing, or reordering a page. New how-to pages go under the matching separator, never at the end.
- Page name equals file stem: `cli` → `www/cli.mdx`. Links use absolute slugs: `[Monorepo](/monorepo)`, `[Configuration](/configuration)`, `[Authoring](/authoring)`.

## Frontmatter

Every `.mdx` opens with:

```mdx
---
title: "CLI"
description: "Run checks, switch output modes, and use exit codes in CI."
icon: Terminal
---
```

- `title`: 1–3 words, task or noun (`Quick Start`, `Monorepo`, `Presets`).
- `description`: one sentence, under 160 chars, states the page job.
- `icon`: one lucide name in PascalCase. In use: `ShieldCheck`, `Zap`, `BookOpen`, `Settings`, `Terminal`, `Boxes`, `Hammer`, `Sparkles`, `Layers`, `Puzzle`, `Braces`, `Wrench`. Reuse one of these before coining a new icon.

## Body conventions

- H1 repeats the title (`# CLI`), then H2 sections in task order. Reference pages (`presets`, `plugins`) use H2 per plugin plus a rule table.
- Code fences carry titles for files: ````ts title="conform.config.ts"````, ````ts title="my-plugin.ts"````, ````json title="package.json"````. Bare ````sh```` for commands, ````json```` for output shapes.
- Tables use `|---|---|` header form with `Term | Meaning`, `Rule | Check`, `Code | Meaning`, or `Flag | Default | Meaning` columns.
- Output blocks show the TUI shape verbatim (`✓`/`⚠`/`✗`, `Summary: N passed · N warned · N failed`) and note that `-v` filters rows while `summary` counts all.
- `Agent hint:` is a single closing line per page where inference hides (engine path, barrel inference, glob expansion). One hint per page, at the point of use.
