import { type Dirent, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Template } from "./types.ts";

const packageRoot = resolve(import.meta.dir, "..");
const templatesDir = join(packageRoot, "templates");

export async function discoverTemplates(): Promise<Map<string, Template>> {
	const map = new Map<string, Template>();
	let entries: Dirent[];
	try {
		entries = readdirSync(templatesDir, { withFileTypes: true });
	} catch {
		return map;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const indexPath = join(templatesDir, entry.name, "index.ts");
		try {
			const mod = await import(indexPath);
			const template: Template = mod.default ?? mod;
			if (template?.name && Array.isArray(template?.rules)) {
				map.set(template.name, template);
			}
		} catch {
			// skip unparseable templates
		}
	}

	return map;
}

export async function resolveTemplate(name: string): Promise<Template | null> {
	const templates = await discoverTemplates();
	return templates.get(name) ?? null;
}
