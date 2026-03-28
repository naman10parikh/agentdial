import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { CONFIG_DIR, CONFIG_FILE } from "./constants.js";
import { AgentDialConfigSchema } from "../adapters/types.js";
import type { AgentDialConfig } from "../adapters/types.js";

export async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function loadConfig(): Promise<AgentDialConfig> {
  await ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    const defaults = AgentDialConfigSchema.parse({});
    await saveConfig(defaults);
    return defaults;
  }

  const raw = await readFile(CONFIG_FILE, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return AgentDialConfigSchema.parse(parsed);
}

export async function saveConfig(config: AgentDialConfig): Promise<void> {
  await ensureConfigDir();
  const json = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_FILE, json + "\n", "utf-8");
}

export async function updateConfig(
  updates: Partial<AgentDialConfig>,
): Promise<AgentDialConfig> {
  const current = await loadConfig();
  const merged = { ...current, ...updates };
  const validated = AgentDialConfigSchema.parse(merged);
  await saveConfig(validated);
  return validated;
}
