import { type } from "arktype";

import { definePlugin, Status } from "@/api/index.ts";
import { DOMAIN } from "@/plugins/utils/domain.ts";
import type { Target } from "@/utils/fs.ts";

export const biomeConfigExistsSchema = type({
  file_expressions: "string[]",
});

export const biomeConfigSchema = type({
  "config?": "Record<string, unknown>",
});

export const biomeScriptSchema = type({
  contains: "string",
  file_expressions: "string[]",
});

const EXPECTED_BIOME_CONFIG: Record<string, unknown> = {
  assist: {
    actions: {
      source: {
        noDuplicateClasses: "off",
        organizeImports: {
          level: "on",
          options: {
            groups: [
              ":URL:",
              ":BLANK_LINE:",
              ":NODE:",
              ":BUN:",
              ":PACKAGE_WITH_PROTOCOL:",
              ":BLANK_LINE:",
              ":PACKAGE:",
              ":BLANK_LINE:",
              ":ALIAS:",
              ":PATH:",
            ],
          },
        },
        preset: "all",
        useSortedPackageJson: "off",
      },
    },
  },
  css: {
    parser: {
      cssModules: true,
      tailwindDirectives: true,
    },
  },
  files: {
    ignoreUnknown: true,
    includes: ["**"],
  },
  formatter: {
    attributePosition: "auto",
    bracketSameLine: false,
    bracketSpacing: true,
    enabled: true,
    expand: "auto",
    formatWithErrors: false,
    indentStyle: "space",
    indentWidth: 2,
    lineEnding: "lf",
    lineWidth: 80,
    useEditorconfig: true,
  },
  html: {
    experimentalFullSupportEnabled: false,
    formatter: {
      selfCloseVoidElements: "always",
    },
  },
  javascript: {
    formatter: {
      arrowParentheses: "always",
      jsxQuoteStyle: "double",
      quoteProperties: "asNeeded",
      quoteStyle: "double",
    },
  },
  linter: {
    domains: {
      types: "all",
    },
    enabled: true,
    rules: {
      a11y: {
        preset: "all",
      },
      complexity: {
        preset: "all",
        useLiteralKeys: "off",
      },
      correctness: {
        noNodejsModules: "off",
        preset: "all",
      },
      nursery: {
        preset: "recommended",
      },
      performance: {
        noBarrelFile: "off",
        preset: "all",
        useTopLevelRegex: "off",
      },
      preset: "recommended",
      security: {
        noSecrets: "off",
        preset: "all",
      },
      style: {
        noContinue: "off",
        noDefaultExport: "off",
        noNestedTernary: "off",
        noTernary: "off",
        preset: "all",
        useNamingConvention: "off",
      },
      suspicious: {
        noEmptySource: "off",
        preset: "all",
      },
    },
  },
  overrides: [
    {
      includes: ["**/*.test.ts"],
      linter: {
        rules: {
          complexity: {
            noExcessiveLinesPerFunction: "off",
          },
          style: {
            noMagicNumbers: "off",
          },
        },
      },
    },
    {
      includes: ["src/plugins/*.ts"],
      linter: {
        rules: {
          style: {
            useExportsLast: "off",
          },
        },
      },
    },
    {
      includes: ["scripts/**/*.ts"],
      linter: {
        rules: {
          complexity: {
            noExcessiveLinesPerFunction: "off",
          },
          correctness: {
            noUndeclaredVariables: "off",
          },
          style: {
            noMagicNumbers: "off",
            noProcessEnv: "off",
          },
          suspicious: {
            noConsole: "off",
            noShadow: "off",
            noUnnecessaryConditions: "off",
          },
        },
      },
    },
  ],
  vcs: {
    clientKind: "git",
    enabled: true,
    useIgnoreFile: true,
  },
};

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const biome = definePlugin({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
    readJson: <T = unknown>(path: string) => target.readJson<T>(path),
  }),
  id: "biome",
})
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "dev-deps",
    name: "@biomejs/biome in devDependencies",
    test({ context }) {
      const version =
        context.packageJson()?.devDependencies?.["@biomejs/biome"];
      if (version) {
        return Status.pass(version);
      }
      return Status.fail("@biomejs/biome not found in devDependencies");
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    files: ["biome.json", "biome.jsonc"],
    id: "config-exists",
    name: "biome.json or biome.jsonc exists",
    params: biomeConfigExistsSchema,
    test({ context, params }) {
      const candidates = params?.file_expressions ?? [
        "biome.json",
        "biome.jsonc",
      ];
      const found = candidates.find((f) => context.fileExists(f));
      if (found) {
        return Status.pass(found);
      }
      return Status.fail(
        `no ${candidates.join(" or ")} found — add a biome config to enforce consistent style`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    files: ["biome.json"],
    id: "config",
    name: "biome.json matches repo config",
    params: biomeConfigSchema,
    test({ context, params }) {
      const raw = context.readJson<Record<string, unknown>>("biome.json");
      if (!raw) {
        return Status.pass(
          "biome.json not found — skipping content check (see biome/config-exists)",
        );
      }

      const { $schema: _schema, ...contentWithoutSchema } = raw as Record<
        string,
        unknown
      > & { $schema?: unknown };

      const expected: Record<string, unknown> = params?.config
        ? { ...EXPECTED_BIOME_CONFIG, ...params.config }
        : EXPECTED_BIOME_CONFIG;

      const diffs: string[] = [];

      for (const [key, expectedValue] of Object.entries(expected)) {
        const actualValue = (contentWithoutSchema as Record<string, unknown>)[
          key
        ];
        if (!isEqual(actualValue, expectedValue)) {
          diffs.push(
            `"${key}": expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`,
          );
        }
      }

      const extraKeys = Object.keys(contentWithoutSchema).filter(
        (k) => !(k in expected),
      );
      if (extraKeys.length > 0) {
        diffs.push(`unexpected keys: ${extraKeys.join(", ")}`);
      }

      if (diffs.length > 0) {
        return Status.fail(`biome.json drift: ${diffs.join("; ")}`);
      }

      return Status.pass("biome.json matches expected config");
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "lint-script",
    name: "lint or check script runs biome",
    params: biomeScriptSchema,
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.file_expressions ?? ["lint", "check"];
      const contains = params?.contains ?? "biome";
      const matched = candidates.find(
        (name) =>
          typeof scripts[name] === "string" && scripts[name].includes(contains),
      );
      if (matched) {
        return Status.pass(scripts[matched] as string);
      }
      return Status.fail(
        `no script [${candidates.join(", ")}] running "${contains}" found`,
      );
    },
  })
  .defineRule({
    domain: DOMAIN.STYLE,
    id: "format-script",
    name: "format script runs biome",
    params: biomeScriptSchema,
    test({ context, params }) {
      const scripts = context.packageJson()?.scripts ?? {};
      const candidates = params?.file_expressions ?? [
        "format",
        "check:format",
        "check:lint",
      ];
      const contains = params?.contains ?? "biome";
      const matched = candidates.find(
        (name) =>
          typeof scripts[name] === "string" && scripts[name].includes(contains),
      );
      if (matched) {
        return Status.pass(scripts[matched] as string);
      }
      return Status.warn(
        `no format script [${candidates.join(", ")}] running "${contains}" found — add a format script to enforce consistent style`,
      );
    },
  });
