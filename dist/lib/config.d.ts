import type { AgentDialConfig } from "../adapters/types.js";
export declare function ensureConfigDir(): Promise<void>;
export declare function getConfigPath(): string;
export declare function loadConfig(): Promise<AgentDialConfig>;
export declare function saveConfig(config: AgentDialConfig): Promise<void>;
export declare function updateConfig(
  updates: Partial<AgentDialConfig>,
): Promise<AgentDialConfig>;
//# sourceMappingURL=config.d.ts.map
