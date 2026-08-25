import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const bunfigExistsSchema = type({
  file_expressions: "string[]",
});

export const bunfigContentSchema = type({
  content: "Record<string, string | number | boolean>",
});

interface BunfigCheck {
  label: string;
  pattern: (value: string) => RegExp;
}

const BUNFIG_CHECKS: Record<string, BunfigCheck> = {
  consoleDepth: {
    label: "console.depth",
    pattern: (value) => new RegExp(`depth\\s*=\\s*${value}`),
  },
  installIgnoreScripts: {
    label: "install.ignore-scripts",
    pattern: (value) => new RegExp(`ignore-scripts\\s*=\\s*${value}`),
  },
  installMinimumReleaseAge: {
    label: "install.minimumReleaseAge",
    pattern: (value) => new RegExp(`minimumReleaseAge\\s*=\\s*${value}`),
  },
  installSaveTextLockfile: {
    label: "install.saveTextLockfile",
    pattern: (value) => new RegExp(`saveTextLockfile\\s*=\\s*${value}`),
  },
  logLevel: {
    label: "logLevel",
    pattern: (value) => new RegExp(`logLevel\\s*=\\s*"${value}"`),
  },
  runBun: {
    label: "run.bun",
    pattern: (value) => new RegExp(`bun\\s*=\\s*${value}`),
  },
  runSilent: {
    label: "run.silent",
    pattern: (value) => new RegExp(`silent\\s*=\\s*${value}`),
  },
  telemetry: {
    label: "telemetry",
    pattern: (value) => new RegExp(`telemetry\\s*=\\s*${value}`),
  },
};

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
    name: "bunfig.toml matches expected config",
    params: bunfigContentSchema,
    test({ context, params }) {
      const raw = context.readFile("bunfig.toml");
      if (!raw) {
        return Status.pass(
          "bunfig.toml not found — skipping content check (see bun/bunfig-exists)",
        );
      }

      const content = params?.content ?? {};

      const diffs: string[] = [];

      for (const [key, value] of Object.entries(content)) {
        const check = BUNFIG_CHECKS[key];
        if (!check) {
          diffs.push(`unknown bunfig key "${key}"`);
          continue;
        }
        const serialized = String(value);
        if (!check.pattern(serialized).test(raw)) {
          diffs.push(`"${check.label} = ${serialized}"`);
        }
      }

      if (diffs.length > 0) {
        return Status.fail(`bunfig.toml drift: missing ${diffs.join("; ")}`);
      }

      return Status.pass("bunfig.toml matches expected config");
    },
  });
