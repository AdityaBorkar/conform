import type { Rule } from "@/types.ts";

import {
  build,
  documentation,
  github,
  observability,
  security,
  style,
} from "./domains.ts";

export const packageJsonRules: Rule[] = [
  style.rule({
    check: (ctx) => {
      if (ctx.packageJson?.type !== "module") {
        return {
          message: `type is "${ctx.packageJson?.type ?? "undefined"}", expected "module"`,
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "type is 'module'",
    files: ["package.json"],
    id: "package-json:type-module",
  }),
  style.rule({
    check: (ctx) => {
      if (ctx.packageJson?.sideEffects !== undefined) {
        const val = ctx.packageJson.sideEffects;
        return {
          message: `sideEffects: ${typeof val === "boolean" ? val : "array"}`,
          status: "pass",
        };
      }
      return {
        message:
          "sideEffects field is missing — bundlers cannot tree-shake without it (set sideEffects: false or an array of files with side effects)",
        status: "warn",
      };
    },
    description: "sideEffects field is defined in package.json",
    files: ["package.json"],
    id: "package-json:side-effects",
  }),
  build.rule({
    check: (ctx) => {
      if (!ctx.packageJson?.name) {
        return { message: "name field is missing", status: "fail" };
      }
      return { message: ctx.packageJson.name, status: "pass" };
    },
    description: "name field is present in package.json",
    files: ["package.json"],
    id: "package-json:name",
  }),
  build.rule({
    check: (ctx) => {
      if (!ctx.packageJson?.version) {
        return { message: "version field is missing", status: "fail" };
      }
      return { message: ctx.packageJson.version, status: "pass" };
    },
    description: "version field is present in package.json",
    files: ["package.json"],
    id: "package-json:version",
  }),
  build.rule({
    check: (ctx) => {
      const pkg = ctx.packageJson;
      const entries = [
        pkg?.main && "main",
        pkg?.module && "module",
        pkg?.exports && "exports",
      ].filter(Boolean);
      if (entries.length > 0) {
        return { message: entries.join(", "), status: "pass" };
      }
      return {
        message: "no main, module, or exports field defined",
        status: "fail",
      };
    },
    description: "main, module, or exports entry defined",
    files: ["package.json"],
    id: "package-json:entry-point",
  }),
  build.rule({
    check: (ctx) => {
      const scripts = ctx.packageJson?.scripts;
      if (scripts?.["prepare"]) {
        return { message: "prepare", status: "pass" };
      }
      if (scripts?.["build"]) {
        return { message: "build", status: "pass" };
      }
      return { message: "no prepare or build script found", status: "fail" };
    },
    description: "scripts.prepare or scripts.build exists",
    files: ["package.json"],
    id: "package-json:build-script",
  }),
  build.rule({
    check: (ctx) => {
      if (ctx.packageJson?.files) {
        return { message: "files field defined", status: "pass" };
      }
      if (ctx.fileExists(".npmignore")) {
        return { message: ".npmignore exists", status: "pass" };
      }
      return {
        message: "no files field or .npmignore found",
        status: "warn",
      };
    },
    description: "files field or .npmignore exists",
    files: ["package.json", ".npmignore"],
    id: "package-json:files-or-npmignore",
  }),
  documentation.rule({
    check: (ctx) => {
      if (!ctx.packageJson?.description) {
        return { message: "description field is missing", status: "warn" };
      }
      return { status: "pass" };
    },
    description: "description field is present in package.json",
    files: ["package.json"],
    id: "package-json:description",
  }),
  observability.rule({
    check: (ctx) => {
      if (ctx.packageJson?.bugs) {
        return { status: "pass" };
      }
      return {
        message:
          "bugs field is missing — users need an issue tracker URL to report problems (set bugs.url or bugs as a string)",
        status: "fail",
      };
    },
    description: "bugs field is present in package.json",
    files: ["package.json"],
    id: "package-json:bugs",
  }),
  observability.rule({
    check: (ctx) => {
      if (ctx.packageJson?.homepage) {
        return { message: ctx.packageJson.homepage, status: "pass" };
      }
      return {
        message:
          "homepage field is missing — helps users find project documentation and support",
        status: "warn",
      };
    },
    description: "homepage field is present in package.json",
    files: ["package.json"],
    id: "package-json:homepage",
  }),
  security.rule({
    check: (ctx) => {
      if (!ctx.packageJson?.license) {
        return { message: "license field is missing", status: "fail" };
      }
      return { message: ctx.packageJson.license, status: "pass" };
    },
    description: "license field is present in package.json",
    files: ["package.json"],
    id: "package-json:license",
  }),
  security.rule({
    check: (ctx) => {
      const scripts = ctx.packageJson?.scripts;
      const dangerousScripts = ["preinstall", "postinstall", "install"];
      const found: string[] = [];
      for (const name of dangerousScripts) {
        if (scripts?.[name]) {
          found.push(name);
        }
      }
      if (found.length > 0) {
        return {
          message: `install lifecycle scripts found: ${found.join(", ")} — these are the #1 supply chain attack vector in npm`,
          status: "fail",
        };
      }
      return { status: "pass" };
    },
    description: "no preinstall/postinstall/install lifecycle scripts",
    files: ["package.json"],
    id: "package-json:no-install-hooks",
  }),
  security.rule({
    check: (ctx) => {
      if (ctx.packageJson?.engines) {
        const entries = Object.entries(ctx.packageJson.engines);
        return {
          message: entries.map(([k, v]) => `${k}: ${v}`).join(", "),
          status: "pass",
        };
      }
      return {
        message:
          "engines field is missing — declare supported Node/Bun versions to prevent installation on incompatible runtimes",
        status: "warn",
      };
    },
    description: "engines field is present in package.json",
    files: ["package.json"],
    id: "package-json:engines",
  }),
  github.rule({
    check: (ctx) => {
      if (!ctx.packageJson?.repository) {
        return { message: "repository field is missing", status: "warn" };
      }
      return { status: "pass" };
    },
    description: "repository field is present in package.json",
    files: ["package.json"],
    id: "package-json:repository",
  }),
];
