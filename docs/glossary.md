# Glossary

| Term | Definition |
|------|-----------|
| **Template** | A named collection of rules defining what a conforming repository looks like. Implemented as a TypeScript module in `./templates/`. |
| **Rule** | A single atomic check. Has an ID, group, description, severity, and a `check` function. Produces a `CheckResult`. |
| **Check** | The act of executing a rule's `check` function against a target repository. |
| **Drift** | Any deviation between a repository's actual state and the expected state defined by its template. Manifests as `warn` or `fail` results. |
| **CheckContext** | The read-only API available to a rule's `check` function. Provides file system access, JSON parsing, and package.json inspection relative to the target path. |
| **CheckResult** | The output of a rule's `check` function. Contains a `status` (pass/warn/fail) and an optional `message`. |
| **Severity** | The importance level of a rule: `fail` (must fix), `warn` (should fix), or `pass` (conformant). |
| **Group** | A string label used to organize rules in TUI output. Rules with the same `group` are displayed together. |
| **conform.config.ts** | The configuration file in a target repository that declares which template to use. |
