import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { CONFIG_DIR, CONFIG_FILE } from "./constants.js";
import { AgentDialConfigSchema } from "../adapters/types.js";
export async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}
export function getConfigPath() {
  return CONFIG_FILE;
}
export async function loadConfig() {
  await ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    const defaults = AgentDialConfigSchema.parse({});
    await saveConfig(defaults);
    return defaults;
  }
  const raw = await readFile(CONFIG_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  return AgentDialConfigSchema.parse(parsed);
}
export async function saveConfig(config) {
  await ensureConfigDir();
  const json = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_FILE, json + "\n", "utf-8");
}
export async function updateConfig(updates) {
  const current = await loadConfig();
  const merged = { ...current, ...updates };
  const validated = AgentDialConfigSchema.parse(merged);
  await saveConfig(validated);
  return validated;
}
//# sourceMappingURL=config.js.map
