import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("e2e: check command", () => {
  it("exits with 0, 1, or 2 when run against a repo with config", () => {
    const proc = spawnSync(
      "bun",
      ["run", "src/cli.ts", "check", "--path", "."],
      { encoding: "utf-8" },
    );

    expect([0, 1, 2]).toContain(proc.status);
  });

  it("exits with code 2 when no config found", () => {
    const proc = spawnSync(
      "bun",
      ["run", "src/cli.ts", "check", "--path", "/tmp"],
      { encoding: "utf-8" },
    );

    expect(proc.status).toBe(2);
  });
});
