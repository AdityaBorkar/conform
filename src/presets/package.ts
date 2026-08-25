import { definePreset } from "@/api/index.ts";
import { biome } from "@/plugins/biome.ts";
import { bun } from "@/plugins/bun.ts";
import { docs } from "@/plugins/docs.ts";
import { github } from "@/plugins/github.ts";
import { gitignore } from "@/plugins/gitignore.ts";
import { husky } from "@/plugins/husky.ts";
import { packageJson } from "@/plugins/package_json.ts";
import { tsconfig_json } from "@/plugins/tsconfig_json.ts";
import { zed } from "@/plugins/zed.ts";

const BIOME_CONFIG = {
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

const BUNFIG_CONFIG = {
  consoleDepth: 10,
  installIgnoreScripts: true,
  installMinimumReleaseAge: 259_200,
  installSaveTextLockfile: false,
  logLevel: "warn",
  runBun: true,
  runSilent: false,
  telemetry: false,
};

const TSCONFIG_COMPILER_OPTIONS = {
  allowImportingTsExtensions: true,
  allowJs: true,
  allowUnreachableCode: false,
  allowUnusedLabels: false,
  composite: true,
  declaration: true,
  declarationMap: true,
  exactOptionalPropertyTypes: true,
  forceConsistentCasingInFileNames: true,
  incremental: true,
  isolatedModules: true,
  jsx: "react-jsx",
  lib: ["ESNext"],
  module: "Preserve",
  moduleDetection: "force",
  moduleResolution: "bundler",
  noEmit: true,
  noEmitOnError: true,
  noFallthroughCasesInSwitch: true,
  noImplicitAny: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noImplicitThis: true,
  noPropertyAccessFromIndexSignature: true,
  noUncheckedIndexedAccess: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  paths: {
    "@/*": ["./src/*"],
  },
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  strictBindCallApply: true,
  strictBuiltinIteratorReturn: true,
  strictFunctionTypes: true,
  strictNullChecks: true,
  strictPropertyInitialization: true,
  stripInternal: true,
  target: "ESNext",
  types: ["@types/bun"],
  useUnknownInCatchVariables: true,
  verbatimModuleSyntax: true,
};

const ZED_CONFIG = {
  file_scan_exclusions: [
    "**/.agents",
    "**/.git",
    "**/.local",
    "**/.output",
    "**/.tanstack",
    "**/.coverage",
    "**/node_modules",
    "codedb.snapshot",
    "tsconfig.tsbuildinfo",
  ],
  format_on_save: "on",
  formatter: [
    { code_action: "source.fixAll.biome" },
    { code_action: "source.organizeImports.biome" },
    { code_action: "source.action.useSortedAttributes.biome" },
    { code_action: "source.action.useSortedKeys.biome" },
    { code_action: "source.action.useSortedPackageJson.biome" },
    { code_action: "source.action.useSortedProperties.biome" },
    { code_action: "source.action.useSortedInterfaceMembers.biome" },
    { code_action: "source.action.useSortedEnumMembers.biome" },
    { code_action: "source.action.noDuplicateClasses.biome" },
    { language_server: { name: "biome" } },
  ],
  lsp: {
    biome: {
      binary: {
        arguments: ["lsp-proxy"],
        path: "./node_modules/.bin/biome",
      },
    },
  },
};

export default definePreset([
  packageJson,
  biome,
  tsconfig_json,
  husky,
  docs,
  gitignore,
  github,
  zed,
  bun,
] as const)({
  description: "Conformance rules for publishing an NPM package",
  name: "package",
  rules: {
    "biome/config": {
      config: BIOME_CONFIG,
    },
    "bun/bunfig-content": {
      content: BUNFIG_CONFIG,
    },
    "gitignore/excludes": {
      file_expressions: ["node_modules", ".env*", "*.env", "*.gen.ts"],
    },
    "husky/hook": {
      hooks: [
        { contains: "bun run format", file: ".husky/pre-commit" },
        { contains: 'bun commitlint --edit "$1"', file: ".husky/commit-msg" },
      ],
    },
    "package-json/required-fields": {
      fields: [
        "license",
        "name",
        "author",
        "contributors",
        "repository",
        "publishConfig",
        "homepage",
        "files",
        "bugs",
        "description",
        "keywords",
        "engines",
      ],
    },
    "typescript/compiler-options": {
      compilerOptions: TSCONFIG_COMPILER_OPTIONS,
    },
    "zed/settings": {
      settings: ZED_CONFIG,
    },
  },
});
