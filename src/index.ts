#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "./lib/constants.js";
import { banner } from "./lib/ui.js";

const program = new Command();

program
  .name("agentdial")
  .description(
    "Dial your AI agent into every platform. One identity. Every channel.",
  )
  .version(VERSION)
  .hook("preAction", (thisCommand) => {
    if (thisCommand.args.length === 0 && !thisCommand.parent) {
      banner();
    }
  });

// ── Setup ──

program
  .command("setup")
  .description("Interactive setup wizard — configure identity and channels")
  .option("-f, --file <path>", "Path to IDENTITY.md file")
  .action(async (opts: { file?: string }) => {
    const { cmdSetup } = await import("./commands/setup.js");
    await cmdSetup(opts);
  });

// ── Channels ──

const channels = program
  .command("channels")
  .description("Manage communication channels");

channels
  .command("add <channel>")
  .description("Add and configure a channel (telegram, discord, slack, ...)")
  .action(async (channel: string) => {
    const { cmdChannelAdd } = await import("./commands/channels.js");
    await cmdChannelAdd(channel);
  });

channels
  .command("remove <channel>")
  .description("Remove a channel configuration")
  .action(async (channel: string) => {
    const { cmdChannelRemove } = await import("./commands/channels.js");
    await cmdChannelRemove(channel);
  });

channels
  .command("list")
  .description("List all configured channels and their status")
  .action(async () => {
    const { cmdChannelList } = await import("./commands/channels.js");
    await cmdChannelList();
  });

channels
  .command("test [channel]")
  .description("Test a channel connection (or all channels)")
  .action(async (channel?: string) => {
    const { cmdChannelTest } = await import("./commands/channels.js");
    await cmdChannelTest(channel);
  });

// ── Voice ──

const voice = program
  .command("voice")
  .description("Voice channel management (Twilio)");

voice
  .command("setup")
  .description("Configure voice channel with Twilio credentials")
  .action(async () => {
    const { cmdVoiceSetup } = await import("./commands/voice.js");
    await cmdVoiceSetup();
  });

voice
  .command("test")
  .description("Test voice channel with a test call")
  .option("-n, --number <phone>", "Phone number to test")
  .action(async (opts: { number?: string }) => {
    const { cmdVoiceTest } = await import("./commands/voice.js");
    await cmdVoiceTest(opts);
  });

// ── Status ──

program
  .command("status")
  .description("Show status of all channels and the gateway")
  .option("-j, --json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { cmdStatus } = await import("./commands/status.js");
    await cmdStatus(opts);
  });

// ── Test ──

program
  .command("test")
  .description("Send a test message through the gateway")
  .option("-c, --channel <channel>", "Channel to test through")
  .option("-m, --message <text>", "Test message text", "Hello from agentdial!")
  .action(async (opts: { channel?: string; message: string }) => {
    const { cmdTest } = await import("./commands/test.js");
    await cmdTest(opts);
  });

// ── Serve ──

program
  .command("serve")
  .description("Start the agentdial gateway server")
  .option("-p, --port <port>", "Gateway port", "3141")
  .option("-a, --agent-url <url>", "Agent backend URL")
  .option("-f, --file <path>", "Path to IDENTITY.md file")
  .option("-t, --tunnel", "Start a public tunnel for webhooks")
  .action(
    async (opts: {
      port: string;
      agentUrl?: string;
      file?: string;
      tunnel?: boolean;
    }) => {
      const { cmdServe } = await import("./commands/serve.js");
      await cmdServe(opts);
    },
  );

// ── Recipes ──

const recipes = program
  .command("recipes")
  .description(
    "Per-platform setup recipes with friction tiers and verification",
  );

recipes.action(async () => {
  const { cmdRecipes } = await import("./commands/recipes.js");
  await cmdRecipes();
});

recipes
  .command("run <channel>")
  .description("Run a recipe for a specific channel (telegram, discord, ...)")
  .action(async (channel: string) => {
    const { cmdRecipesRun } = await import("./commands/recipes.js");
    await cmdRecipesRun(channel);
  });

recipes
  .command("verify")
  .description("Verify all configured channels are working end-to-end")
  .action(async () => {
    const { cmdRecipesVerify } = await import("./commands/recipes.js");
    await cmdRecipesVerify();
  });

// ── Auth ──

program
  .command("login")
  .description("Authenticate with AgentDial via Clerk OAuth")
  .option("--skip-provision", "Skip auto-provisioning channels after login")
  .option("--clerk-url <url>", "Override Clerk frontend API URL")
  .action(async (opts: { skipProvision?: boolean; clerkUrl?: string }) => {
    const { cmdLogin } = await import("./commands/login.js");
    await cmdLogin(opts);
  });

program
  .command("logout")
  .description("Clear stored authentication credentials")
  .action(async () => {
    const { cmdLogout } = await import("./commands/login.js");
    await cmdLogout();
  });

program
  .command("whoami")
  .description("Show current authentication status")
  .option("-j, --json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { cmdWhoami } = await import("./commands/login.js");
    await cmdWhoami(opts);
  });

// ── MCP Serve ──

program
  .command("mcp-serve")
  .description("Start as an MCP server for Claude Code integration")
  .action(async () => {
    const { cmdMcpServe } = await import("./commands/mcp-serve.js");
    await cmdMcpServe();
  });

// ── Default action (show help with banner) ──

program.action(() => {
  banner();
  program.help();
});

program.parse();
