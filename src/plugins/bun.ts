import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const bunfigExistsSchema = type({
  file_expressions: "string[]",
});

export const bunfigContentSchema = type({
  "consoleDepth?": "number",
  "installIgnoreScripts?": "boolean",
  "installMinimumReleaseAge?": "number",
  "installSaveTextLockfile?": "boolean",
  "logLevel?": "string",
  "runBun?": "boolean",
  "runSilent?": "boolean",
  "telemetry?": "boolean",
});

const DEFAULT_CONSOLE_DEPTH = 10;
const DEFAULT_MINIMUM_RELEASE_AGE = 259_200;

function buildBunfigChecks(expected: {
  consoleDepth: number;
  installIgnoreScripts: boolean;
  installMinimumReleaseAge: number;
  installSaveTextLockfile: boolean;
  logLevel: string;
  runBun: boolean;
  runSilent: boolean;
  telemetry: boolean;
}): Array<{ label: string; pattern: RegExp; value: unknown }> {
  return [
    {
      label: "telemetry",
      pattern: new RegExp(`telemetry\\s*=\\s*${String(expected.telemetry)}`),
      value: expected.telemetry,
    },
    {
      label: "logLevel",
      pattern: new RegExp(`logLevel\\s*=\\s*"${String(expected.logLevel)}"`),
      value: expected.logLevel,
    },
    {
      label: "console.depth",
      pattern: new RegExp(`depth\\s*=\\s*${String(expected.consoleDepth)}`),
      value: expected.consoleDepth,
    },
    {
      label: "run.bun",
      pattern: new RegExp(`bun\\s*=\\s*${String(expected.runBun)}`),
      value: expected.runBun,
    },
    {
      label: "run.silent",
      pattern: new RegExp(`silent\\s*=\\s*${String(expected.runSilent)}`),
      value: expected.runSilent,
    },
    {
      label: "install.minimumReleaseAge",
      pattern: new RegExp(
        `minimumReleaseAge\\s*=\\s*${String(expected.installMinimumReleaseAge)}`,
      ),
      value: expected.installMinimumReleaseAge,
    },
    {
      label: "install.saveTextLockfile",
      pattern: new RegExp(
        `saveTextLockfile\\s*=\\s*${String(expected.installSaveTextLockfile)}`,
      ),
      value: expected.installSaveTextLockfile,
    },
    {
      label: "install.ignore-scripts",
      pattern: new RegExp(
        `ignore-scripts\\s*=\\s*${String(expected.installIgnoreScripts)}`,
      ),
      value: expected.installIgnoreScripts,
    },
  ];
}

export const bun = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readFile: (path: string) => target.readFile(path),
  }),
  id: "bun",
})
  .defineRule({
    domain: DOMAIN.BUILD,
    files: ["bunfig.toml"],
    id: "bunfig-exists",
    name: "bunfig.toml exists",
    params: bunfigExistsSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? ["bunfig.toml"];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`${candidates.join(" or ")} not found`);
    },
  })
  .defineRule({
    domain: DOMAIN.BUILD,
    files: ["bunfig.toml"],
    id: "bunfig-content",
    name: "bunfig.toml matches repo config",
    params: bunfigContentSchema,
    test({ context, params }) {
      const raw = context.readFile("bunfig.toml");
      if (!raw) {
        return Status.pass(
          "bunfig.toml not found — skipping content check (see bun/bunfig-exists)",
        );
      }

      const expected = {
        consoleDepth: params?.consoleDepth ?? DEFAULT_CONSOLE_DEPTH,
        installIgnoreScripts: params?.installIgnoreScripts ?? true,
        installMinimumReleaseAge:
          params?.installMinimumReleaseAge ?? DEFAULT_MINIMUM_RELEASE_AGE,
        installSaveTextLockfile: params?.installSaveTextLockfile ?? false,
        logLevel: params?.logLevel ?? "warn",
        runBun: params?.runBun ?? true,
        runSilent: params?.runSilent ?? false,
        telemetry: params?.telemetry ?? false,
      };

      const checks = buildBunfigChecks(expected);

      const missing = checks
        .filter(({ pattern }) => !pattern.test(raw))
        .map(({ label, value }) => `"${label} = ${String(value)}"`);

      if (missing.length > 0) {
        return Status.fail(`bunfig.toml drift: missing ${missing.join("; ")}`);
      }

      return Status.pass("bunfig.toml matches expected config");
    },
  });
