import { join } from "node:path";
import type { ConformConfig } from "./types.ts";

export async function loadConfig(
	targetPath: string,
): Promise<ConformConfig | null> {
	const configPath = join(targetPath, "conform.config.ts");
	try {
		const mod = await import(configPath);
		const config: ConformConfig = mod.default ?? mod;
		if (config?.template) return config;
		return null;
	} catch {
		return null;
	}
}
