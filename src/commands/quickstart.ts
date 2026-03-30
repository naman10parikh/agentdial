import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import { parseIdentity, writeIdentity } from "../lib/identity.js";
import { ensureConfigDir, saveConfig } from "../lib/config.js";
import { listConfiguredChannels } from "../lib/credentials.js";
import {
  BuiltInAgent,
  saveAgentConfig,
  loadAgentConfig,
} from "../lib/built-in-agent.js";
import { banner, success, info, error, warn, heading, box } from "../lib/ui.js";
import {
  DEFAULT_IDENTITY_FILE,
  CHANNEL_DISPLAY_NAMES,
  FREE_CHANNELS,
} from "../lib/constants.js";
import { AgentDialConfigSchema } from "../adapters/types.js";
import type { ChannelType, Identity } from "../adapters/types.js";
import {
  setupTelegramGuided,
  setupDiscord,
  setupSlackOAuth,
} from "./channel-flows.js";

// ── Helpers ──

type RL = ReturnType<typeof createInterface>;

async function ask(rl: RL, prompt: string, fallback?: string): Promise<string> {
  const suffix = fallback ? chalk.dim(` (${fallback})`) : "";
  const answer = (await rl.question(`  ${prompt}${suffix} `)).trim();
  return answer || fallback || "";
}

async function confirm(
  rl: RL,
  prompt: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  const answer = (await rl.question(`  ${prompt} ${hint} `))
    .trim()
    .toLowerCase();
  if (!answer) return defaultYes;
  return answer.startsWith("y");
}

// ── Provider Detection ──

function detectProvider(apiKey: string): "anthropic" | "openai" | null {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("sk-")) return "openai";
  return null;
}

function findEnvApiKey(): {
  key: string;
  provider: "anthropic" | "openai";
} | null {
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  if (anthropicKey) return { key: anthropicKey, provider: "anthropic" };

  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) return { key: openaiKey, provider: "openai" };

  return null;
}

// ── Main Quickstart ──

export async function cmdQuickstart(opts: { file?: string }): Promise<void> {
  banner();
  console.log("");
  heading("Quickstart — API key to live agent in 90 seconds");
  console.log("");

  await ensureConfigDir();

  const identityPath = resolve(opts.file ?? DEFAULT_IDENTITY_FILE);
  const rl = createInterface({ input: stdin, output: stdout });

  const enabledChannels: ChannelType[] = [];

  try {
    // ── Step 1: Identity ──
    heading("1/4  Name your agent");

    let existingIdentity: Identity | null = null;
    if (existsSync(identityPath)) {
      try {
        existingIdentity = await parseIdentity(identityPath);
        info(`Found existing identity: ${existingIdentity.name}`);
      } catch {
        /* corrupt file — we'll overwrite */
      }
    }

    const name = await ask(
      rl,
      "Agent name?",
      existingIdentity?.name ?? "Spark",
    );
    if (!name) {
      error("Agent name is required.");
      return;
    }

    const tagline = await ask(
      rl,
      "One-line description?",
      existingIdentity?.tagline ?? "A helpful AI assistant",
    );

    // ── Step 2: API Key ──
    heading("2/4  Connect your brain");

    const existingAgent = await loadAgentConfig();
    let builtInReady = false;

    if (existingAgent) {
      info("Found existing agent config. Validating...");
      const check = await BuiltInAgent.validateKey(
        existingAgent.provider,
        existingAgent.apiKey,
      );
      if (check.valid) {
        success(
          `${existingAgent.provider === "anthropic" ? "Anthropic" : "OpenAI"} key valid (${check.model ?? "default"})`,
        );
        builtInReady = true;
      } else {
        warn("Saved API key is invalid. Let's set a new one.");
      }
    }

    if (!builtInReady) {
      const envKey = findEnvApiKey();

      let apiKey: string;
      let provider: "anthropic" | "openai";

      if (envKey) {
        info(
          `Found ${envKey.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"} in environment.`,
        );
        const useEnv = await confirm(rl, "Use this key?");
        if (useEnv) {
          apiKey = envKey.key;
          provider = envKey.provider;
        } else {
          apiKey = await ask(rl, "Paste your API key (Anthropic or OpenAI):");
          if (!apiKey) {
            error("API key is required.");
            return;
          }
          const detected = detectProvider(apiKey);
          provider = detected ?? "anthropic";
        }
      } else {
        console.log(
          chalk.dim(
            "  Get a key: anthropic.com/settings/keys or platform.openai.com/api-keys",
          ),
        );
        apiKey = await ask(rl, "Paste your API key:");
        if (!apiKey) {
          error("API key is required.");
          return;
        }
        const detected = detectProvider(apiKey);
        provider = detected ?? "anthropic";
      }

      info(`Validating ${provider} key...`);
      const validation = await BuiltInAgent.validateKey(provider, apiKey);
      if (!validation.valid) {
        error(`Invalid key: ${validation.error ?? "unknown error"}`);
        return;
      }
      success(`Key valid! Model: ${validation.model ?? "default"}`);

      await saveAgentConfig({
        provider,
        apiKey,
        model: validation.model,
        systemPrompt: "",
      });
      builtInReady = true;
      success("Agent brain configured.");
    }

    // ── Step 3: Free Channels ──
    heading("3/4  Connect channels (all free)");

    const configured = await listConfiguredChannels();
    const hasTelegram = configured.includes("telegram");
    const hasDiscord = configured.includes("discord");
    const hasSlack = configured.includes("slack");

    // Telegram — default Y (free, 2 min)
    if (hasTelegram) {
      success("Telegram already configured.");
      enabledChannels.push("telegram");
    } else {
      console.log("");
      if (await confirm(rl, "Set up Telegram bot? (free, 2 min)")) {
        if (await setupTelegramGuided(rl, name)) {
          enabledChannels.push("telegram");
        }
      }
    }

    // Discord — default Y (free, 3 min)
    if (hasDiscord) {
      success("Discord already configured.");
      enabledChannels.push("discord");
    } else {
      console.log("");
      if (await confirm(rl, "Set up Discord bot? (free, 3 min)")) {
        if (await setupDiscord(rl)) {
          enabledChannels.push("discord");
        }
      }
    }

    // Slack — default N (more steps)
    if (hasSlack) {
      success("Slack already configured.");
      enabledChannels.push("slack");
    } else {
      console.log("");
      if (await confirm(rl, "Set up Slack app? (free, 5 min)", false)) {
        if (await setupSlackOAuth(rl, name)) {
          enabledChannels.push("slack");
        }
      }
    }

    if (enabledChannels.length === 0) {
      warn("No channels configured. You can add them later with:");
      info("  agentdial channels add telegram");
      info("  agentdial channels add discord");
    }

    // ── Save Identity + Config ──
    heading("4/4  Launching");

    const channelsMap: Record<string, { enabled: boolean }> = {};
    for (const ch of enabledChannels) {
      channelsMap[ch] = { enabled: true };
    }

    const identity: Identity = {
      name,
      tagline: tagline || undefined,
      version: existingIdentity?.version ?? "1.0.0",
      channels: channelsMap as Identity["channels"],
    };

    await writeIdentity(identityPath, identity);
    success(`IDENTITY.md saved`);

    const config = AgentDialConfigSchema.parse({
      identityFile: identityPath,
    });
    await saveConfig(config);
    success("Config saved");

    // ── Summary ──
    const channelLines = enabledChannels.map((ch) => {
      const label = CHANNEL_DISPLAY_NAMES[ch] ?? ch;
      const isFree = FREE_CHANNELS.has(ch);
      return `  ${chalk.green("\u2713")} ${label}${isFree ? chalk.dim(" (free)") : ""}`;
    });

    const summaryLines = [
      chalk.bold(`"${name}"`),
      tagline ? chalk.dim(tagline) : "",
      "",
      builtInReady ? chalk.green("\u2713") + " Built-in agent ready" : "",
      "",
      enabledChannels.length > 0
        ? `${enabledChannels.length} channel${enabledChannels.length > 1 ? "s" : ""} configured:`
        : "No channels yet",
      ...channelLines,
      "",
      "Starting gateway with tunnel...",
    ].filter(Boolean);

    console.log("");
    box("Ready to Launch", summaryLines.join("\n"));
    console.log("");

    // Close readline before serve takes over stdin
    rl.close();

    // ── Auto-launch gateway ──
    const { cmdServe } = await import("./serve.js");
    await cmdServe({ port: "3141", tunnel: true, file: identityPath });
  } catch (err) {
    if (err instanceof Error && err.message.includes("readline was closed")) {
      // User hit Ctrl+C during readline — exit gracefully
      return;
    }
    throw err;
  } finally {
    // Ensure readline is closed even on error
    try {
      rl.close();
    } catch {
      /* already closed */
    }
  }
}
