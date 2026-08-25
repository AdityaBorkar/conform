import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import type { Target } from "@/utils/fs.ts";
import { DOMAIN } from "./utils/domain.ts";

export const zedDirSchema = type({
  file_expressions: "string[]",
});

export const zedSettingsExistsSchema = type({
  file_expressions: "string[]",
});

export const zedSettingsSchema = type({
  "code_actions_on_format?": "Record<string, unknown>",
  "file_scan_exclusions?": "string[]",
  "format_on_save?": "string",
  "formatter?": "Record<string, unknown>",
  "language_servers?": "string[]",
  "lsp?": "Record<string, unknown>",
});

const EXPECTED_ZED_SETTINGS: Record<string, unknown> = {
  code_actions_on_format: {
    "source.fixAll.biome": true,
    "source.organizeImports.biome": true,
  },
  file_scan_exclusions: [
    "**/.git",
    "**/.output",
    "**/node_modules",
    "codedb.snapshot",
  ],
  format_on_save: "on",
  formatter: {
    language_server: {
      name: "biome",
    },
  },
  language_servers: ["!markdownlint", "!oxfmt", "!oxlint", "..."],
  lsp: {
    biome: {
      binary: {
        arguments: ["lsp-proxy"],
        path: "./node_modules/@biomejs/cli-linux-x64/biome",
      },
    },
  },
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const zed = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    readJson: <T = unknown>(path: string) => target.readJson<T>(path),
  }),
  id: "zed",
})
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".zed"],
    id: "dir",
    name: ".zed/ directory exists",
    params: zedDirSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [".zed"];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`${candidates.join(" or ")} not found`);
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".zed/settings.json"],
    id: "settings-exists",
    name: ".zed/settings.json exists",
    params: zedSettingsExistsSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [".zed/settings.json"];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(`${candidates.join(" or ")} not found`);
    },
  })
  .defineRule({
    domain: DOMAIN.DEV_ENVIRONMENT,
    files: [".zed/settings.json"],
    id: "settings",
    name: ".zed/settings.json matches repo config",
    params: zedSettingsSchema,
    test({ context, params }) {
      const raw =
        context.readJson<Record<string, unknown>>(".zed/settings.json");
      if (!raw) {
        return Status.fail(
          ".zed/settings.json not found or invalid JSON — skipping content check (see zed/settings-exists)",
        );
      }

      const expected: Record<string, unknown> = {
        ...EXPECTED_ZED_SETTINGS,
        ...(params ?? {}),
      };

      const diffs: string[] = [];
      for (const [key, expectedValue] of Object.entries(expected)) {
        const actualValue = raw[key];
        if (!deepEqual(actualValue, expectedValue)) {
          diffs.push(
            `"${key}": expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`,
          );
        }
      }

      const extraKeys = Object.keys(raw).filter((k) => !(k in expected));
      if (extraKeys.length > 0) {
        diffs.push(`unexpected keys: ${extraKeys.join(", ")}`);
      }

      if (diffs.length > 0) {
        return Status.fail(`.zed/settings.json drift: ${diffs.join("; ")}`);
      }

      return Status.pass("all .zed/settings.json fields match");
    },
  });
