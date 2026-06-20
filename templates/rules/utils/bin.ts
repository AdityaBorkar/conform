export function getBinPaths(pkg: { bin?: unknown }): string[] {
  if (!pkg.bin) {
    return [];
  }
  if (typeof pkg.bin === "string") {
    return [pkg.bin];
  }
  if (typeof pkg.bin === "object" && pkg.bin !== null) {
    return Object.values(pkg.bin as Record<string, string>);
  }
  return [];
}
