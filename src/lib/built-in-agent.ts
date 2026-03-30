import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "./constants.js";
import type { GatewayMessage, GatewayResponse } from "../adapters/types.js";

// ── Agent Config ──

export interface AgentConfig {
  provider: "anthropic" | "openai";
  apiKey: string;
  model?: string;
  systemPrompt: string;
  maxHistory?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AGENT_CONFIG_FILE = join(CONFIG_DIR, "agent.json");

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

// ── Persistence ──

export async function loadAgentConfig(): Promise<AgentConfig | null> {
  if (!existsSync(AGENT_CONFIG_FILE)) return null;
  try {
    const raw = await readFile(AGENT_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey ?? parsed.api_key ?? "",
      model: parsed.model,
      systemPrompt: parsed.systemPrompt ?? parsed.system_prompt ?? "",
      maxHistory: parsed.maxHistory ?? parsed.max_history,
    } as AgentConfig;
  } catch {
    return null;
  }
}

export async function saveAgentConfig(config: AgentConfig): Promise<void> {
  const { writeFile, mkdir } = await import("node:fs/promises");
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(
    AGENT_CONFIG_FILE,
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

// ── Identity body extraction ──

const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n*([\s\S]*)$/;

export async function extractSystemPrompt(
  identityPath: string,
): Promise<string> {
  if (!existsSync(identityPath)) {
    return "You are a helpful AI assistant.";
  }
  const raw = await readFile(identityPath, "utf-8");
  const match = FRONTMATTER_REGEX.exec(raw);
  const body = match?.[1]?.trim();
  return body || "You are a helpful AI assistant.";
}

// ── Built-in Agent ──

export class BuiltInAgent {
  private conversations = new Map<string, ChatMessage[]>();
  private config: Required<AgentConfig>;

  constructor(config: AgentConfig) {
    this.config = {
      ...config,
      model:
        config.model ||
        DEFAULT_MODELS[config.provider] ||
        "claude-sonnet-4-20250514",
      maxHistory: config.maxHistory ?? 20,
    };
  }

  async handleMessage(msg: GatewayMessage): Promise<GatewayResponse> {
    const userId = msg.from;
    const history = this.conversations.get(userId) ?? [];

    history.push({ role: "user", content: msg.text });

    const assistantText =
      this.config.provider === "anthropic"
        ? await this.callAnthropic(history)
        : await this.callOpenAI(history);

    history.push({ role: "assistant", content: assistantText });

    // Trim history if over limit
    if (history.length > this.config.maxHistory * 2) {
      history.splice(0, history.length - this.config.maxHistory * 2);
    }
    this.conversations.set(userId, history);

    return { text: assistantText };
  }

  private async callAnthropic(history: ChatMessage[]): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 1024,
        system: this.config.systemPrompt,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      throw new Error(`Anthropic API ${String(res.status)}: ${body}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content.find((b) => b.type === "text");
    return textBlock?.text ?? "(no response)";
  }

  private async callOpenAI(history: ChatMessage[]): Promise<string> {
    const messages = [
      { role: "system" as const, content: this.config.systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      throw new Error(`OpenAI API ${String(res.status)}: ${body}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message.content ?? "(no response)";
  }

  static async validateKey(
    provider: string,
    apiKey: string,
  ): Promise<{ valid: boolean; model?: string; error?: string }> {
    try {
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODELS.anthropic,
            max_tokens: 8,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "unknown");
          return { valid: false, error: `${String(res.status)}: ${body}` };
        }
        return { valid: true, model: DEFAULT_MODELS.anthropic };
      }

      // OpenAI
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODELS.openai,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 8,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "unknown");
        return { valid: false, error: `${String(res.status)}: ${body}` };
      }
      return { valid: true, model: DEFAULT_MODELS.openai };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
