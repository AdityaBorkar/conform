import { RuleSet, Status } from "@/api/index.ts";
import type { PackageJson } from "@/types.ts";
import type { Target } from "@/utils/fs.ts";

import { DOMAIN } from "./utils/domain.ts";

const _husky = new RuleSet<{
  fileExists: (path: string) => boolean;
  packageJson: () => PackageJson | null;
  readFile: (path: string) => string | null;
}>({
  context: (target: Target) => ({
    fileExists: (path: string) => target.fileExists(path),
    packageJson: () => target.packageJson(),
    readFile: (path: string) => target.readFile(path),
  }),
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "husky",
});

_husky.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "dev-deps",
  name: "husky in devDependencies",
  test({ context }) {
    const huskyVersion = context.packageJson()?.devDependencies?.["husky"];
    if (huskyVersion) {
      return Status.pass(huskyVersion);
    }
    return Status.fail("husky not found in devDependencies");
  },
});

_husky.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "hooks-dir",
  name: ".husky/ directory exists",
  test({ context }) {
    if (context.fileExists(".husky")) {
      return Status.pass();
    }
    return Status.fail(".husky/ directory not found");
  },
});

_husky.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
  id: "prepare-script",
  name: "prepare script calls husky",
  test({ context }) {
    const prepare = context.packageJson()?.scripts?.["prepare"];
    if (prepare?.includes("husky")) {
      return Status.pass(prepare);
    }
    if (!prepare) {
      return Status.fail("no prepare script found");
    }
    return Status.fail(`prepare is "${prepare}", expected to call husky`);
  },
});

export interface HuskyHookSpec {
  contains: string;
  file: string;
}

// biome-ignore lint/style/useExportsLast: public API re-exported alongside rule helpers
export const DEFAULT_HUSKY_HOOKS: readonly HuskyHookSpec[] = [
  { contains: "bun run format", file: ".husky/pre-commit" },
  { contains: 'bun commitlint --edit "$1"', file: ".husky/commit-msg" },
] as const;

function normalizeHookSpec(raw: unknown): HuskyHookSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const file = (obj["file"] ?? obj["path"]) as unknown;
  const contains = (obj["contains"] ??
    obj["content"] ??
    obj["expected"] ??
    obj["text"]) as unknown;
  if (typeof file === "string" && typeof contains === "string") {
    return { contains, file };
  }
  return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: options parsing handles multiple ergonomic input shapes
export function resolveHuskyHooks(options?: unknown[]): HuskyHookSpec[] {
  if (!options || options.length === 0) {
    return [...DEFAULT_HUSKY_HOOKS];
  }

  // ["error", [{ file, contains }, ...]]  -> single array argument
  if (options.length === 1 && Array.isArray(options[0])) {
    const arr = options[0] as unknown[];
    const specs = arr.map(normalizeHookSpec).filter(Boolean) as HuskyHookSpec[];
    if (specs.length > 0) {
      return specs;
    }
  }

  // ["error", { file, contains }, { file, contains }, ...] -> spread objects
  const objectSpecs = options
    .map(normalizeHookSpec)
    .filter(Boolean) as HuskyHookSpec[];
  if (objectSpecs.length > 0) {
    // if every option was a hook object, return them
    if (objectSpecs.length === options.length) {
      return objectSpecs;
    }
    // mixed or partial – return whatever parsed
    return objectSpecs;
  }

  // ["error", ".husky/pre-commit", "bun run format"] -> single string pair
  if (
    options.length === 2 &&
    typeof options[0] === "string" &&
    typeof options[1] === "string"
  ) {
    return [{ contains: options[1], file: options[0] }];
  }

  // ["error", "file1", "content1", "file2", "content2", ...] -> flat string pairs
  if (options.length % 2 === 0 && options.every((v) => typeof v === "string")) {
    const specs: HuskyHookSpec[] = [];
    for (let i = 0; i < options.length; i += 2) {
      specs.push({
        contains: options[i + 1] as string,
        file: options[i] as string,
      });
    }
    if (specs.length > 0) {
      return specs;
    }
  }

  return [...DEFAULT_HUSKY_HOOKS];
}

_husky.defineRule({
  domain: DOMAIN.DEV_ENVIRONMENT,
  files: [...DEFAULT_HUSKY_HOOKS.map((h) => h.file)],
  id: "hook",
  name: "husky hook file exists with expected content",
  test({ context, options }) {
    const specs = resolveHuskyHooks(options);

    const failures: string[] = [];
    for (const { file, contains } of specs) {
      if (!context.fileExists(file)) {
        failures.push(`${file} not found`);
        continue;
      }
      const content = context.readFile(file);
      if (!content) {
        failures.push(`${file} is empty or unreadable`);
        continue;
      }
      if (!content.includes(contains)) {
        failures.push(`${file} does not contain "${contains}"`);
      }
    }

    if (failures.length === 0) {
      const summary = specs
        .map((s) => `${s.file}: contains "${s.contains}"`)
        .join(", ");
      return Status.pass(summary);
    }

    return Status.fail(failures.join("; "));
  },
});

export const husky = _husky;
