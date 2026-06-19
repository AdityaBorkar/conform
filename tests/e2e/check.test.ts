import { describe, expect, it } from "bun:test";

describe("e2e: check command", () => {
  it("runs against this repo and produces JSON output", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "check", "--path", ".", "--json"],
      {
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect([0, 1, 2]).toContain(exitCode);

    const parsed = JSON.parse(stdout);
    expect(parsed.template).toBeDefined();
    expect(parsed.path).toBeDefined();
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.summary).toBeDefined();
    expect(typeof parsed.summary.pass).toBe("number");
    expect(typeof parsed.summary.warn).toBe("number");
    expect(typeof parsed.summary.fail).toBe("number");
  });

  it("exits with code 2 when no config found", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "check", "--path", "/tmp", "--json"],
      {
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(2);
  });
});
