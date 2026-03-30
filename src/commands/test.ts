import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadConfig } from "../lib/config.js";
import { routeMessage } from "../lib/gateway.js";
import {
  BuiltInAgent,
  loadAgentConfig,
  extractSystemPrompt,
} from "../lib/built-in-agent.js";
import { heading, success, error, info, warn } from "../lib/ui.js";
import { ChannelTypeSchema } from "../adapters/types.js";
import { DEFAULT_IDENTITY_FILE } from "../lib/constants.js";
import type { GatewayMessage } from "../adapters/types.js";

export async function cmdTest(opts: {
  channel?: string;
  message: string;
}): Promise<void> {
  heading("Gateway Test");

  const config = await loadConfig();
  const channel = opts.channel ? ChannelTypeSchema.parse(opts.channel) : "web";

  const testMessage: GatewayMessage = {
    id: randomUUID(),
    channel,
    from: "agentdial-test",
    text: opts.message,
    timestamp: Date.now(),
  };

  // ── Try built-in agent first ──
  const agentConfig = await loadAgentConfig();
  const envKey =
    process.env["ANTHROPIC_API_KEY"] ?? process.env["OPENAI_API_KEY"];

  if (!config.agentUrl && (agentConfig || envKey)) {
    const provider = agentConfig
      ? agentConfig.provider
      : process.env["ANTHROPIC_API_KEY"]
        ? "anthropic"
        : "openai";
    const apiKey = agentConfig?.apiKey ?? envKey!;

    const identityPath = resolve(config.identityFile ?? DEFAULT_IDENTITY_FILE);
    const systemPrompt = await extractSystemPrompt(identityPath);

    const agent = new BuiltInAgent({
      provider: provider as "anthropic" | "openai",
      apiKey,
      model: agentConfig?.model,
      systemPrompt,
    });

    info(`Built-in agent (${provider})`);
    info(`Channel: ${channel}`);
    info(`Message: "${opts.message}"`);

    try {
      const response = await agent.handleMessage(testMessage);
      success("Agent responded:");
      console.log("");
      console.log(`  ${response.text}`);

      if (response.cards && response.cards.length > 0) {
        info(`${String(response.cards.length)} card(s) attached`);
      }
      if (response.actions && response.actions.length > 0) {
        info(`${String(response.actions.length)} action(s) attached`);
      }
      console.log("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Built-in agent failed: ${msg}`);
    }
    return;
  }

  // ── Fall back to HTTP proxy ──
  if (!config.agentUrl) {
    error("No agent backend configured.");
    info("Run: agentdial setup             (interactive wizard)");
    info("Or:  agentdial serve --agent-url <url>");
    info("Or:  export ANTHROPIC_API_KEY=sk-...");
    return;
  }

  info(`Sending to ${config.agentUrl}...`);
  info(`Channel: ${channel}`);
  info(`Message: "${opts.message}"`);

  try {
    const response = await routeMessage(testMessage, config.agentUrl);
    success("Agent responded:");
    console.log("");
    console.log(`  ${response.text}`);

    if (response.cards && response.cards.length > 0) {
      info(`${String(response.cards.length)} card(s) attached`);
    }
    if (response.actions && response.actions.length > 0) {
      info(`${String(response.actions.length)} action(s) attached`);
    }
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Test failed: ${msg}`);

    if (msg.includes("ECONNREFUSED")) {
      warn("Is your agent backend running?");
      info(`Expected at: ${config.agentUrl}`);
    }
  }
}
