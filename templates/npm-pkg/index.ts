import { defineTemplate, rule } from "../../src/template-api.ts";

type JsrConfig = {
	name?: string;
	version?: string;
	exports?: Record<string, string> | string;
	description?: string;
	runtimeCompat?: {
		deno?: boolean;
		node?: boolean;
		bun?: boolean;
		browser?: boolean;
		workerd?: boolean;
	};
};

function resolveJsrConfig(ctx: {
	readJson: <T = unknown>(relPath: string) => T | null;
	packageJson?: { description?: string } | null;
}): { jsr: JsrConfig | null; source: string } {
	const jsr = ctx.readJson<JsrConfig>("jsr.json");
	if (jsr) return { jsr, source: "jsr.json" };
	const deno = ctx.readJson<JsrConfig>("deno.json");
	if (deno) return { jsr: deno, source: "deno.json" };
	return { jsr: null, source: "package.json" };
}

function getExportPaths(ctx: {
	readJson: <T = unknown>(relPath: string) => T | null;
}): string[] {
	const config = resolveJsrConfig(ctx);
	const exports = config.jsr?.exports;
	if (!exports) return [];
	if (typeof exports === "string") return [exports];
	return Object.values(exports);
}

const FENCED_CODE_RE = /```|~~~/;
const INDENTED_CODE_RE = /\n\s*?\n( {4}|\t)[^\S\n]*\S/;

function hasCodeBlock(content: string): boolean {
	return FENCED_CODE_RE.test(content) || INDENTED_CODE_RE.test(content);
}

const EXPORTED_SYMBOL_RE =
	/export\s+(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
const JSDOC_PRECEDING_RE = /\*\/\s*$/;

function countDocumentedSymbols(content: string): {
	total: number;
	documented: number;
} {
	let total = 0;
	let documented = 0;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	const textBefore = (idx: number) =>
		content.slice(Math.max(0, idx - 200), idx);

	match = EXPORTED_SYMBOL_RE.exec(content);
	while (match !== null) {
		if (match.index >= lastIndex) {
			lastIndex = match.index;
			total++;
			const before = textBefore(match.index);
			if (JSDOC_PRECEDING_RE.test(before)) {
				documented++;
			}
		}
		match = EXPORTED_SYMBOL_RE.exec(content);
	}
	return { total, documented };
}

const SLOW_TYPE_PATTERNS: {
	pattern: RegExp;
	message: string;
}[] = [
	{
		pattern: /export\s+function\s+\w+\s*\([^)]*\)\s*\{/,
		message: "exported function is missing an explicit return type (slow type)",
	},
	{
		pattern:
			/export\s+(?:const|let)\s+\w+\s*=\s*(?:crypto|Math|Date|JSON|Object|Array|Promise|Symbol|Number|String|Boolean)\b/,
		message:
			"exported variable with complex initializer is missing a type annotation (slow type)",
	},
	{
		pattern: /export\s+const\s+\{[^}]+\}\s*=/,
		message:
			"export destructuring is a slow type — export each symbol individually",
	},
	{
		pattern: /export\s*=\s*(?!module\.exports)/,
		message: "CommonJS export syntax is a slow type — use ESM export syntax",
	},
	{
		pattern: /import\s+\w+\s*=\s*require\s*\(/,
		message: "CommonJS import syntax is a slow type — use ESM import syntax",
	},
	{
		pattern: /declare\s+global\s*\{/,
		message: "global augmentation is a slow type",
	},
	{
		pattern: /declare\s+module\s+/,
		message: "module augmentation is a slow type",
	},
	{
		pattern: /export\s+as\s+namespace\s+/,
		message: "export as namespace is a slow type",
	},
	{
		pattern: /export\s+class\s+\w+[^{]*\b\w+\s*[;=]/,
		message: "exported class property is missing a type annotation (slow type)",
	},
];

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
			description: "README.md exists and is non-empty (JSR: has_readme — 2pts)",
			severity: "fail",
			check: (ctx) => {
				const content = ctx.readFile("README.md");
				if (content === null) {
					return { status: "fail", message: "README.md not found" };
				}
				if (content.trim().length === 0) {
					return { status: "fail", message: "README.md is empty" };
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
		rule({
			id: "jsr:readme-examples",
			group: "jsr:documentation",
			description:
				"README contains code examples (JSR: has_readme_examples — 1pt)",
			severity: "fail",
			check: (ctx) => {
				const readme = ctx.readFile("README.md");
				if (readme && hasCodeBlock(readme)) {
					return { status: "pass", message: "README contains code examples" };
				}
				return {
					status: "fail",
					message:
						"README.md does not contain fenced (``` or ~~~) or indented code blocks — JSR requires examples for full documentation score",
				};
			},
		}),
		rule({
			id: "jsr:entrypoint-module-docs",
			group: "jsr:documentation",
			description:
				"all exported entrypoints have JSDoc module documentation (JSR: all_entrypoints_docs — 1pt)",
			severity: "fail",
			check: (ctx) => {
				const config = resolveJsrConfig(ctx);
				const exportPaths = getExportPaths(ctx);
				if (exportPaths.length === 0) {
					return {
						status: "pass",
						message: "no exports defined — skipping entrypoint doc check",
					};
				}
				const readmeExists = ctx.readFile("README.md") !== null;
				const missing: string[] = [];
				const mainExport =
					typeof config.jsr?.exports === "string"
						? config.jsr.exports
						: config.jsr?.exports?.["."];
				for (const expPath of exportPaths) {
					if (expPath === mainExport && readmeExists) continue;
					const content = ctx.readFile(expPath);
					if (content === null) continue;
					const hasModuleDoc = /^\s*\/\*\*[\s\S]*?\*\//.test(content);
					if (!hasModuleDoc) {
						missing.push(expPath);
					}
				}
				if (missing.length === 0) {
					return {
						status: "pass",
						message: "all entrypoints have module docs",
					};
				}
				return {
					status: "fail",
					message: `entrypoints missing JSDoc module documentation: ${missing.join(", ")}`,
				};
			},
		}),
		rule({
			id: "jsr:documented-symbols",
			group: "jsr:documentation",
			description:
				"≥80% of exported symbols have JSDoc documentation (JSR: percentage_documented_symbols — 5pts)",
			severity: "warn",
			check: (ctx) => {
				const exportPaths = getExportPaths(ctx);
				if (exportPaths.length === 0) {
					return {
						status: "pass",
						message: "no exports defined — skipping symbol doc check",
					};
				}
				let total = 0;
				let documented = 0;
				const filesUnderThreshold: string[] = [];
				for (const expPath of exportPaths) {
					const content = ctx.readFile(expPath);
					if (content === null) continue;
					const result = countDocumentedSymbols(content);
					total += result.total;
					documented += result.documented;
					if (result.total > 0 && result.documented / result.total < 0.8) {
						filesUnderThreshold.push(
							`${expPath} (${result.documented}/${result.total})`,
						);
					}
				}
				if (total === 0) {
					return {
						status: "pass",
						message: "no exported symbols found — nothing to document",
					};
				}
				const pct = Math.round((documented / total) * 100);
				if (pct >= 80) {
					return {
						status: "pass",
						message: `${pct}% of exported symbols are documented (${documented}/${total})`,
					};
				}
				return {
					status: "warn",
					message: `only ${pct}% of exported symbols are documented (${documented}/${total}) — JSR requires ≥80% for full score. Files below threshold: ${filesUnderThreshold.join(", ")}`,
				};
			},
		}),
		rule({
			id: "jsr:no-slow-types",
			group: "jsr:best-practices",
			description:
				"no slow types in exported symbols (JSR: all_fast_check — 5pts)",
			severity: "fail",
			check: (ctx) => {
				const exportPaths = getExportPaths(ctx);
				if (exportPaths.length === 0) {
					return {
						status: "pass",
						message: "no exports defined — skipping slow types check",
					};
				}
				const violations: string[] = [];
				for (const expPath of exportPaths) {
					const content = ctx.readFile(expPath);
					if (content === null) continue;
					for (const { pattern, message } of SLOW_TYPE_PATTERNS) {
						if (pattern.test(content)) {
							violations.push(`${expPath}: ${message}`);
						}
					}
				}
				if (violations.length === 0) {
					return { status: "pass", message: "no slow types detected" };
				}
				return {
					status: "fail",
					message: `slow types detected:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
				};
			},
		}),
		rule({
			id: "jsr:provenance",
			group: "jsr:best-practices",
			description:
				"publish workflow uses jsr publish with provenance (JSR: has_provenance — 1pt)",
			severity: "warn",
			check: (ctx) => {
				const ghDir = ctx.fileExists(".github");
				if (!ghDir) {
					return {
						status: "warn",
						message: "no .github directory found — cannot check provenance",
					};
				}
				const workflowFiles = [
					".github/workflows/publish.yml",
					".github/workflows/publish.yaml",
					".github/workflows/release.yml",
					".github/workflows/release.yaml",
					".github/workflows/ci.yml",
					".github/workflows/ci.yaml",
				];
				const found: string[] = [];
				for (const wf of workflowFiles) {
					const content = ctx.readFile(wf);
					if (content === null) continue;
					if (
						content.includes("jsr publish") ||
						content.includes("deno publish")
					) {
						if (content.includes("--no-provenance")) {
							found.push(`${wf} (has --no-provenance — provenance disabled)`);
						} else {
							found.push(wf);
						}
					}
				}
				if (found.length === 0) {
					return {
						status: "warn",
						message:
							"no GitHub Actions workflow found that runs jsr publish or deno publish — provenance requires publishing from GitHub Actions",
					};
				}
				const hasDisabled = found.some((f) => f.includes("--no-provenance"));
				if (hasDisabled) {
					return {
						status: "warn",
						message: `found publish workflows but provenance may be disabled:\n${found.map((f) => `  - ${f}`).join("\n")}`,
					};
				}
				return {
					status: "pass",
					message: `found publish workflow with provenance: ${found.join(", ")}`,
				};
			},
		}),
		rule({
			id: "jsr:has-description",
			group: "jsr:discoverability",
			description:
				"package has a description for discoverability (JSR: has_description — 1pt)",
			severity: "fail",
			check: (ctx) => {
				const config = resolveJsrConfig(ctx);
				const description =
					config.jsr?.description ?? ctx.packageJson?.description;
				if (description && description.trim().length > 0) {
					return {
						status: "pass",
						message: `description found in ${config.jsr ? config.source : "package.json"}`,
					};
				}
				return {
					status: "fail",
					message: `no description found in ${config.source} or package.json — JSR requires a description for discoverability`,
				};
			},
		}),
		rule({
			id: "jsr:runtime-compat",
			group: "jsr:compatibility",
			description:
				"at least one runtime marked as compatible (JSR: at_least_one_runtime_compatible — 1pt)",
			severity: "fail",
			check: (ctx) => {
				const config = resolveJsrConfig(ctx);
				const compat = config.jsr?.runtimeCompat;
				if (!compat) {
					return {
						status: "fail",
						message:
							"no runtimeCompat field found in jsr.json or deno.json — mark at least one runtime as compatible",
					};
				}
				const runtimes = ["deno", "node", "bun", "browser", "workerd"] as const;
				const compatible: string[] = [];
				for (const rt of runtimes) {
					if (compat[rt] === true) {
						compatible.push(rt);
					}
				}
				if (compatible.length === 0) {
					return {
						status: "fail",
						message:
							"no runtimes marked as compatible in runtimeCompat — mark at least one",
					};
				}
				return {
					status: "pass",
					message: `compatible runtimes: ${compatible.join(", ")}`,
				};
			},
		}),
		rule({
			id: "jsr:runtime-compat-multiple",
			group: "jsr:compatibility",
			description:
				"multiple runtimes marked as compatible (JSR: multiple_runtimes_compatible — 1pt)",
			severity: "warn",
			check: (ctx) => {
				const config = resolveJsrConfig(ctx);
				const compat = config.jsr?.runtimeCompat;
				if (!compat) {
					return {
						status: "warn",
						message: "no runtimeCompat field found",
					};
				}
				const runtimes = ["deno", "node", "bun", "browser", "workerd"] as const;
				const compatible: string[] = [];
				for (const rt of runtimes) {
					if (compat[rt] === true) {
						compatible.push(rt);
					}
				}
				if (compatible.length >= 2) {
					return {
						status: "pass",
						message: `compatible runtimes: ${compatible.join(", ")}`,
					};
				}
				return {
					status: "warn",
					message: `only ${compatible.length} runtime(s) marked compatible — JSR rewards ≥2 for full compatibility score`,
				};
			},
		}),
	],
});
