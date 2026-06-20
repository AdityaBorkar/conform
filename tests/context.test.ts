import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCheckContext } from "@/context.ts";

let tempDir: string | null = null;

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "conform-test-"));
  tempDir = dir;
  return dir;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("createCheckContext", () => {
  it("returns targetPath", () => {
    const dir = makeTempDir();
    const ctx = createCheckContext(dir);
    expect(ctx.targetPath).toBe(dir);
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "hello.txt"), "hi");
      const ctx = createCheckContext(dir);
      expect(ctx.fileExists("hello.txt")).toBe(true);
    });

    it("returns false for missing file", () => {
      const dir = makeTempDir();
      const ctx = createCheckContext(dir);
      expect(ctx.fileExists("nope.txt")).toBe(false);
    });
  });

  describe("readFile", () => {
    it("returns file content", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "data.txt"), "hello world");
      const ctx = createCheckContext(dir);
      expect(ctx.readFile("data.txt")).toBe("hello world");
    });

    it("returns null for missing file", () => {
      const dir = makeTempDir();
      const ctx = createCheckContext(dir);
      expect(ctx.readFile("missing.txt")).toBeNull();
    });

    it("caches reads", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "cached.txt"), "original");
      const ctx = createCheckContext(dir);
      expect(ctx.readFile("cached.txt")).toBe("original");
      writeFileSync(join(dir, "cached.txt"), "changed");
      expect(ctx.readFile("cached.txt")).toBe("original");
    });
  });

  describe("readJson", () => {
    it("parses valid JSON", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "data.json"), '{"key":"value"}');
      const ctx = createCheckContext(dir);
      expect(ctx.readJson<{ key: string }>("data.json")).toEqual({
        key: "value",
      });
    });

    it("strips single-line comments", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "commented.json"), '{\n  "a": 1 // inline\n}');
      const ctx = createCheckContext(dir);
      expect(ctx.readJson<{ a: number }>("commented.json")).toEqual({ a: 1 });
    });

    it("strips block comments", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "block.json"), '{\n  /* block */\n  "b": 2\n}');
      const ctx = createCheckContext(dir);
      expect(ctx.readJson<{ b: number }>("block.json")).toEqual({ b: 2 });
    });

    it("returns null for invalid JSON", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "bad.json"), "not json");
      const ctx = createCheckContext(dir);
      expect(ctx.readJson("bad.json")).toBeNull();
    });

    it("returns null for missing file", () => {
      const dir = makeTempDir();
      const ctx = createCheckContext(dir);
      expect(ctx.readJson("missing.json")).toBeNull();
    });
  });

  describe("packageJson", () => {
    it("loads package.json automatically", () => {
      const dir = makeTempDir();
      writeFileSync(
        join(dir, "package.json"),
        '{"name":"test-pkg","version":"1.0.0"}',
      );
      const ctx = createCheckContext(dir);
      expect(ctx.packageJson).not.toBeNull();
      expect(ctx.packageJson?.name).toBe("test-pkg");
      expect(ctx.packageJson?.version).toBe("1.0.0");
    });

    it("is null when no package.json exists", () => {
      const dir = makeTempDir();
      const ctx = createCheckContext(dir);
      expect(ctx.packageJson).toBeNull();
    });
  });
});
