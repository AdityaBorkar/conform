import { defineTemplate, rule } from "../../src/template-api.ts";

export default defineTemplate({
	name: "npm-publish",
	description: "Conformance rules for publishing an NPM package",
	rules: [
		rule({
			id: "package-json:name",
			group: "package.json",
			description: "name field is present in package.json",
			severity: "fail",
			check: (ctx) => {
				if (!ctx.packageJson?.name) {
					return { status: "fail", message: "name field is missing" };
				}
				return { status: "pass", message: ctx.packageJson.name };
			},
		}),
		rule({
			id: "package-json:version",
			group: "package.json",
			description: "version field is present in package.json",
			severity: "fail",
			check: (ctx) => {
				if (!ctx.packageJson?.version) {
					return { status: "fail", message: "version field is missing" };
				}
				return { status: "pass", message: ctx.packageJson.version };
			},
		}),
		rule({
			id: "package-json:description",
			group: "package.json",
			description: "description field is present in package.json",
			severity: "warn",
			check: (ctx) => {
				if (!ctx.packageJson?.description) {
					return { status: "warn", message: "description field is missing" };
				}
				return { status: "pass" };
			},
		}),
		rule({
			id: "package-json:license",
			group: "package.json",
			description: "license field is present in package.json",
			severity: "fail",
			check: (ctx) => {
				if (!ctx.packageJson?.license) {
					return { status: "fail", message: "license field is missing" };
				}
				return { status: "pass", message: ctx.packageJson.license };
			},
		}),
		rule({
			id: "package-json:entry-point",
			group: "package.json",
			description: "main, module, or exports entry defined",
			severity: "fail",
			check: (ctx) => {
				const pkg = ctx.packageJson;
				const entries = [
					pkg?.main && `main`,
					pkg?.module && `module`,
					pkg?.exports && `exports`,
				].filter(Boolean);
				if (entries.length > 0) {
					return { status: "pass", message: entries.join(", ") };
				}
				return {
					status: "fail",
					message: "no main, module, or exports field defined",
				};
			},
		}),
		rule({
			id: "package-json:files-or-npmignore",
			group: "package.json",
			description: "files field or .npmignore exists",
			severity: "warn",
			check: (ctx) => {
				if (ctx.packageJson?.files) {
					return { status: "pass", message: "files field defined" };
				}
				if (ctx.fileExists(".npmignore")) {
					return { status: "pass", message: ".npmignore exists" };
				}
				return {
					status: "warn",
					message: "no files field or .npmignore found",
				};
			},
		}),
		rule({
			id: "package-json:repository",
			group: "package.json",
			description: "repository field is present in package.json",
			severity: "warn",
			check: (ctx) => {
				if (!ctx.packageJson?.repository) {
					return { status: "warn", message: "repository field is missing" };
				}
				return { status: "pass" };
			},
		}),
		rule({
			id: "package-json:type-module",
			group: "package.json",
			description: "type is 'module'",
			severity: "fail",
			check: (ctx) => {
				if (ctx.packageJson?.type !== "module") {
					return {
						status: "fail",
						message: `type is "${ctx.packageJson?.type ?? "undefined"}", expected "module"`,
					};
				}
				return { status: "pass" };
			},
		}),
		rule({
			id: "package-json:build-script",
			group: "package.json",
			description: "scripts.prepare or scripts.build exists",
			severity: "fail",
			check: (ctx) => {
				const scripts = ctx.packageJson?.scripts;
				if (scripts?.prepare) {
					return { status: "pass", message: "prepare" };
				}
				if (scripts?.build) {
					return { status: "pass", message: "build" };
				}
				return { status: "fail", message: "no prepare or build script found" };
			},
		}),
		rule({
			id: "husky:dev-deps",
			group: "husky",
			description: "husky in devDependencies",
			severity: "fail",
			check: (ctx) => {
				if (ctx.packageJson?.devDependencies?.husky) {
					return {
						status: "pass",
						message: ctx.packageJson.devDependencies.husky,
					};
				}
				return {
					status: "fail",
					message: "husky not found in devDependencies",
				};
			},
		}),
		rule({
			id: "husky:hooks-dir",
			group: "husky",
			description: ".husky/ directory exists",
			severity: "fail",
			check: (ctx) => {
				if (ctx.fileExists(".husky")) {
					return { status: "pass" };
				}
				return { status: "fail", message: ".husky/ directory not found" };
			},
		}),
		rule({
			id: "husky:prepare-script",
			group: "husky",
			description: "prepare script calls husky",
			severity: "fail",
			check: (ctx) => {
				const prepare = ctx.packageJson?.scripts?.prepare;
				if (prepare?.includes("husky")) {
					return { status: "pass", message: prepare };
				}
				if (!prepare) {
					return { status: "fail", message: "no prepare script found" };
				}
				return {
					status: "fail",
					message: `prepare is "${prepare}", expected to call husky`,
				};
			},
		}),
		rule({
			id: "husky:pre-commit-hook",
			group: "husky",
			description: "pre-commit hook exists",
			severity: "warn",
			check: (ctx) => {
				if (ctx.fileExists(".husky/pre-commit")) {
					return { status: "pass" };
				}
				return { status: "warn", message: "no pre-commit hook found" };
			},
		}),
		rule({
			id: "husky:commit-msg-hook",
			group: "husky",
			description: "commit-msg hook exists",
			severity: "warn",
			check: (ctx) => {
				if (ctx.fileExists(".husky/commit-msg")) {
					return { status: "pass" };
				}
				return { status: "warn", message: "no commit-msg hook found" };
			},
		}),
		rule({
			id: "biome:dev-deps",
			group: "biome",
			description: "@biomejs/biome in devDependencies",
			severity: "fail",
			check: (ctx) => {
				const version = ctx.packageJson?.devDependencies?.["@biomejs/biome"];
				if (version) {
					return { status: "pass", message: version };
				}
				return {
					status: "fail",
					message: "@biomejs/biome not found in devDependencies",
				};
			},
		}),
		rule({
			id: "biome:config-file",
			group: "biome",
			description: "biome.json or biome.jsonc exists",
			severity: "warn",
			check: (ctx) => {
				if (ctx.fileExists("biome.json")) {
					return { status: "pass", message: "biome.json" };
				}
				if (ctx.fileExists("biome.jsonc")) {
					return { status: "pass", message: "biome.jsonc" };
				}
				return {
					status: "warn",
					message: "no biome.json or biome.jsonc found",
				};
			},
		}),
		rule({
			id: "biome:lint-script",
			group: "biome",
			description: "lint or check script runs biome",
			severity: "fail",
			check: (ctx) => {
				const scripts = ctx.packageJson?.scripts ?? {};
				const lintScript = scripts.lint ?? scripts.check;
				if (lintScript?.includes("biome")) {
					return { status: "pass", message: lintScript };
				}
				return {
					status: "fail",
					message: "no script running biome check/lint found",
				};
			},
		}),
		rule({
			id: "typescript:deps",
			group: "typescript",
			description: "typescript in devDependencies or peerDependencies",
			severity: "fail",
			check: (ctx) => {
				const version =
					ctx.packageJson?.devDependencies?.typescript ??
					ctx.packageJson?.peerDependencies?.typescript;
				if (version) {
					return { status: "pass", message: version };
				}
				return {
					status: "fail",
					message:
						"typescript not found in devDependencies or peerDependencies",
				};
			},
		}),
		rule({
			id: "typescript:tsconfig",
			group: "typescript",
			description: "tsconfig.json exists",
			severity: "fail",
			check: (ctx) => {
				if (ctx.fileExists("tsconfig.json")) {
					return { status: "pass" };
				}
				return { status: "fail", message: "tsconfig.json not found" };
			},
		}),
		rule({
			id: "typescript:strict",
			group: "typescript",
			description: "strict: true in tsconfig",
			severity: "fail",
			check: (ctx) => {
				const tsconfig = ctx.readJson<{
					compilerOptions?: { strict?: boolean };
				}>("tsconfig.json");
				if (tsconfig?.compilerOptions?.strict === true) {
					return { status: "pass" };
				}
				return {
					status: "fail",
					message: "strict mode not enabled in tsconfig.json",
				};
			},
		}),
		rule({
			id: "files:license",
			group: "files",
			description: "LICENSE file exists",
			severity: "fail",
			check: (ctx) => {
				if (
					ctx.fileExists("LICENSE") ||
					ctx.fileExists("LICENSE.md") ||
					ctx.fileExists("LICENSE.txt")
				) {
					return { status: "pass" };
				}
				return { status: "fail", message: "no LICENSE file found" };
			},
		}),
		rule({
			id: "files:readme",
			group: "files",
			description: "README.md exists and is non-empty",
			severity: "warn",
			check: (ctx) => {
				const content = ctx.readFile("README.md");
				if (content === null) {
					return { status: "warn", message: "README.md not found" };
				}
				if (content.trim().length === 0) {
					return { status: "warn", message: "README.md is empty" };
				}
				return { status: "pass" };
			},
		}),
		rule({
			id: "files:gitignore",
			group: "files",
			description: ".gitignore exists",
			severity: "fail",
			check: (ctx) => {
				if (ctx.fileExists(".gitignore")) {
					return { status: "pass" };
				}
				return { status: "fail", message: ".gitignore not found" };
			},
		}),
	],
});
