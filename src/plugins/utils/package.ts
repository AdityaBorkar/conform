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
  params?: string[] | { fields: string[] },
  fallback: readonly string[] = DEFAULT_REQUIRED_PACKAGE_FIELDS,
): string[] {
  if (!params) {
    return [...fallback];
  }
  if (Array.isArray(params)) {
    return [...params];
  }
  if (
    params !== null &&
    typeof params === "object" &&
    "fields" in params &&
    Array.isArray((params as { fields: unknown }).fields)
  ) {
    return [...(params as { fields: string[] }).fields];
  }
  return [...fallback];
}

export function summarize(errors: type.errors): string {
  return Object.entries(errors.flatProblemsByPath)
    .map(([field, problems]) => `${field}: ${problems.join(", ")}`)
    .join("; ");
}
