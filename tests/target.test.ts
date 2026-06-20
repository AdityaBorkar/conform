import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTarget } from "@/target.ts";

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

describe("createTarget", () => {
  it("returns targetPath", () => {
    const dir = makeTempDir();
    const target = createTarget(dir);
    expect(target.targetPath).toBe(dir);
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "hello.txt"), "hi");
      const target = createTarget(dir);
      expect(target.fileExists("hello.txt")).toBe(true);
    });

    it("returns false for missing file", () => {
      const dir = makeTempDir();
      const target = createTarget(dir);
      expect(target.fileExists("nope.txt")).toBe(false);
    });
  });

  describe("readFile", () => {
    it("returns file content", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "data.txt"), "hello world");
      const target = createTarget(dir);
      expect(target.readFile("data.txt")).toBe("hello world");
    });

    it("returns null for missing file", () => {
      const dir = makeTempDir();
      const target = createTarget(dir);
      expect(target.readFile("missing.txt")).toBeNull();
    });

    it("caches reads", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "cached.txt"), "original");
      const target = createTarget(dir);
      expect(target.readFile("cached.txt")).toBe("original");
      writeFileSync(join(dir, "cached.txt"), "changed");
      expect(target.readFile("cached.txt")).toBe("original");
    });
  });

  describe("readJson", () => {
    it("parses valid JSON", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "data.json"), '{"key":"value"}');
      const target = createTarget(dir);
      expect(target.readJson<{ key: string }>("data.json")).toEqual({
        key: "value",
      });
    });

    it("strips single-line comments", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "commented.json"), '{\n  "a": 1 // inline\n}');
      const target = createTarget(dir);
      expect(target.readJson<{ a: number }>("commented.json")).toEqual({
        a: 1,
      });
    });

    it("strips block comments", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "block.json"), '{\n  /* block */\n  "b": 2\n}');
      const target = createTarget(dir);
      expect(target.readJson<{ b: number }>("block.json")).toEqual({ b: 2 });
    });

    it("returns null for invalid JSON", () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, "bad.json"), "not json");
      const target = createTarget(dir);
      expect(target.readJson("bad.json")).toBeNull();
    });

    it("returns null for missing file", () => {
      const dir = makeTempDir();
      const target = createTarget(dir);
      expect(target.readJson("missing.json")).toBeNull();
    });
  });

  describe("packageJson", () => {
    it("loads package.json on demand", () => {
      const dir = makeTempDir();
      writeFileSync(
        join(dir, "package.json"),
        '{"name":"test-pkg","version":"1.0.0"}',
      );
      const target = createTarget(dir);
      expect(target.packageJson()).not.toBeNull();
      expect(target.packageJson()?.name).toBe("test-pkg");
      expect(target.packageJson()?.version).toBe("1.0.0");
    });

    it("is null when no package.json exists", () => {
      const dir = makeTempDir();
      const target = createTarget(dir);
      expect(target.packageJson()).toBeNull();
    });

    it("caches the result", () => {
      const dir = makeTempDir();
      writeFileSync(
        join(dir, "package.json"),
        '{"name":"test-pkg","version":"1.0.0"}',
      );
      const target = createTarget(dir);
      const first = target.packageJson();
      writeFileSync(join(dir, "package.json"), '{"name":"changed"}');
      expect(target.packageJson()).toBe(first);
    });
  });
});
