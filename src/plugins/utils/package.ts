import type { type } from "arktype";

export const DEFAULT_REQUIRED_PACKAGE_FIELDS = [
  "license",
  "name",
  "author",
  "contributors",
  "repository",
] as const;

export function isDefined(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

export function resolveFields(
  options?: unknown[],
  fallback: readonly string[] = DEFAULT_REQUIRED_PACKAGE_FIELDS,
): string[] {
  if (!options || options.length === 0) {
    return [...fallback];
  }
  const [first] = options;
  if (Array.isArray(first) && first.every((v) => typeof v === "string")) {
    return first as string[];
  }
  if (
    first !== null &&
    typeof first === "object" &&
    !Array.isArray(first) &&
    "fields" in (first as Record<string, unknown>)
  ) {
    const fields = (first as Record<string, unknown>)["fields"];
    if (Array.isArray(fields) && fields.every((v) => typeof v === "string")) {
      return fields as string[];
    }
  }
  if (options.every((v) => typeof v === "string")) {
    return options as string[];
  }
  return [...fallback];
}

export function summarize(errors: type.errors): string {
  return Object.entries(errors.flatProblemsByPath)
    .map(([field, problems]) => `${field}: ${problems.join(", ")}`)
    .join("; ");
}
