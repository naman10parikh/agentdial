import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { exec } from "node:child_process";
import { platform } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { parseIdentity, writeIdentity } from "../lib/identity.js";
import { ensureConfigDir, saveConfig } from "../lib/config.js";
import {
  saveCredential,
  getCredential,
  listConfiguredChannels,
} from "../lib/credentials.js";
import { banner, success, info, error, warn, heading, box } from "../lib/ui.js";
import {
  DEFAULT_IDENTITY_FILE,
  CREDENTIALS_DIR,
  CHANNEL_DISPLAY_NAMES,
  FREE_CHANNELS,
} from "../lib/constants.js";
import type { ChannelType, Identity } from "../adapters/types.js";
import { AgentDialConfigSchema } from "../adapters/types.js";
import {
  validateTwilioAccount,
  searchTwilioNumbers,
  buyTwilioNumber,
  formatPhone,
  validateTelegramToken,
} from "../lib/provisioning.js";
import {
  setupSlackOAuth,
  setupTelegramGuided,
  setupDiscord,
  setupEmail,
} from "./channel-flows.js";

// ── Helpers ──

type RL = ReturnType<typeof createInterface>;

async function ask(rl: RL, prompt: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
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

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`, () => {
    /* intentionally silent */
  });
}

// ── Twilio Auto-Provision ──

async function provisionTwilio(
  rl: RL,
  agentUrl: string,
): Promise<string | null> {
  const sid = await getCredential("sms", "account_sid");
  const token = await getCredential("sms", "auth_token");

  if (sid && token) {
    info("Found existing Twilio credentials.");
    const validation = await validateTwilioAccount(sid, token);
    if (!validation.ok) {
      error(`Twilio credentials invalid: ${validation.error}`);
      return null;
    }
    success(`Twilio account: ${validation.name} (${validation.status})`);
  } else {
    heading("Twilio Setup");
    info("To get SMS + Voice + WhatsApp, you need a Twilio account.");
    info("Sign up at twilio.com/try-twilio (free trial includes $15 credit)");
    console.log("");

    if (await confirm(rl, "Open Twilio signup page?")) {
      openBrowser("https://www.twilio.com/try-twilio");
    }
    console.log("");

    const newSid = await ask(rl, "Paste your Account SID (AC...):");
    if (!newSid) return null;
    const newToken = await ask(rl, "Paste your Auth Token:");
    if (!newToken) return null;

    info("Validating...");
    const validation = await validateTwilioAccount(newSid, newToken);
    if (!validation.ok) {
      error(`Invalid credentials: ${validation.error}`);
      return null;
    }
    success(`Account: ${validation.name} (${validation.status})`);

    // Save for all Twilio channels
    for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
      await saveCredential(ch, "account_sid", newSid);
      await saveCredential(ch, "auth_token", newToken);
    }
    return await buyNumber(rl, newSid, newToken, agentUrl);
  }

  // Credentials exist — check for existing phone number
  const existingPhone = await getCredential("sms", "phone_number");
  if (existingPhone) {
    success(`Phone number already configured: ${formatPhone(existingPhone)}`);
    return existingPhone;
  }

  // Offer to buy
  if (await confirm(rl, "Buy a phone number? ($1.15/mo)")) {
    return await buyNumber(rl, sid!, token!, agentUrl);
  }
  return null;
}

async function buyNumber(
  rl: RL,
  sid: string,
  token: string,
  agentUrl: string,
): Promise<string | null> {
  info("Searching for available numbers...");
  try {
    const numbers = await searchTwilioNumbers(sid, token, { limit: 5 });
    if (numbers.length === 0) {
      error("No numbers available. Try again or buy manually at twilio.com.");
      return null;
    }

    console.log("");
    info("Available numbers:");
    for (let i = 0; i < numbers.length; i++) {
      const n = numbers[i]!;
      const caps = n.capabilities.join(", ");
      console.log(`    ${i + 1}) ${formatPhone(n.number)}  [${caps}]`);
    }
    console.log("");

    const pick = await ask(
      rl,
      "Pick a number (1-" + numbers.length + "):",
      "1",
    );
    const idx = parseInt(pick, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= numbers.length) {
      error("Invalid selection.");
      return null;
    }

    const chosen = numbers[idx]!;
    info(`Purchasing ${formatPhone(chosen.number)}...`);

    const webhookBase = agentUrl.replace(/\/api\/chat\/?$/, "");
    const result = await buyTwilioNumber(
      sid,
      token,
      chosen.number,
      webhookBase,
    );

    // Save phone number for all Twilio channels
    for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
      await saveCredential(ch, "phone_number", result.number);
    }

    success(`Number purchased: ${formatPhone(result.number)}`);
    info(`SMS webhook:   ${result.smsWebhook}`);
    info(`Voice webhook: ${result.voiceWebhook}`);
    return result.number;
  } catch (err) {
    error(
      `Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    return null;
  }
}

// ── Smart Credential Detection ──

interface DetectedChannel {
  channel: ChannelType;
  source: string; // "credentials" | "env" | ".env"
  detail: string; // e.g. phone number, bot username
}

async function detectExistingChannels(): Promise<DetectedChannel[]> {
  const found: DetectedChannel[] = [];

  // Check ~/.agentdial/credentials/
  const configured = await listConfiguredChannels();
  for (const ch of configured) {
    if (ch === "sms") {
      const phone = await getCredential("sms", "phone_number");
      const sid = await getCredential("sms", "account_sid");
      if (sid) {
        const detail = phone ? formatPhone(phone) : "no number yet";
        found.push({ channel: "sms", source: "credentials", detail });
        // Twilio credentials are shared — check for whatsapp and voice too
        if (!found.some((f) => f.channel === "whatsapp")) {
          found.push({ channel: "whatsapp", source: "credentials", detail });
        }
        if (!found.some((f) => f.channel === "voice")) {
          found.push({ channel: "voice", source: "credentials", detail });
        }
      }
    } else if (ch === "whatsapp" || ch === "voice") {
      // Already handled above via sms
      continue;
    } else if (ch === "telegram") {
      const token = await getCredential("telegram", "bot_token");
      if (token) {
        const result = await validateTelegramToken(token);
        const detail = result.ok ? `@${result.username}` : "invalid token";
        found.push({ channel: "telegram", source: "credentials", detail });
      }
    } else {
      const keys = ch === "discord" ? "bot_token" : "bot_token";
      const val = await getCredential(ch, keys);
      if (val) {
        found.push({
          channel: ch,
          source: "credentials",
          detail: "configured",
        });
      }
    }
  }

  // Check environment variables
  const envMap: [string, ChannelType, string][] = [
    ["TWILIO_ACCOUNT_SID", "sms", "Twilio"],
    ["TELEGRAM_BOT_TOKEN", "telegram", "Telegram"],
    ["DISCORD_BOT_TOKEN", "discord", "Discord"],
    ["SLACK_BOT_TOKEN", "slack", "Slack"],
    ["SENDGRID_API_KEY", "email", "SendGrid"],
  ];

  for (const [envVar, ch, label] of envMap) {
    if (process.env[envVar] && !found.some((f) => f.channel === ch)) {
      found.push({ channel: ch, source: "env", detail: `from $${envVar}` });
    }
  }

  // Check .env file in cwd
  const dotenvPath = join(process.cwd(), ".env");
  if (existsSync(dotenvPath)) {
    try {
      const content = await readFile(dotenvPath, "utf-8");
      for (const [envVar, ch, label] of envMap) {
        if (
          content.includes(`${envVar}=`) &&
          !found.some((f) => f.channel === ch)
        ) {
          found.push({ channel: ch, source: ".env", detail: `from .env` });
        }
      }
    } catch {
      /* intentionally silent — .env read is best-effort */
    }
  }

  return found;
}

// ── Main Setup ──

export async function cmdSetup(opts: { file?: string }): Promise<void> {
  banner();
  heading("Quick Setup");
  info("One command. All channels. Your agent goes live in 60 seconds.");

  await ensureConfigDir();

  const identityPath = resolve(opts.file ?? DEFAULT_IDENTITY_FILE);
  let existingIdentity: Identity | null = null;
  if (existsSync(identityPath)) {
    try {
      existingIdentity = await parseIdentity(identityPath);
      info(`Found existing identity: ${existingIdentity.name}`);
    } catch {
      /* corrupt file — overwrite */
    }
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // ── Step 1: Agent basics ──
    heading("1/4  Agent Identity");
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
      "What does it do?",
      existingIdentity?.tagline ?? "An AI assistant",
    );
    const agentUrl = await ask(
      rl,
      "Agent backend URL?",
      existingIdentity?.agent_url ?? "http://localhost:3000/api/chat",
    );

    // ── Step 2: Smart credential detection ──
    heading("2/4  Detecting Existing Channels");
    const detected = await detectExistingChannels();
    const enabledChannels: ChannelType[] = ["web"];

    if (detected.length > 0) {
      info("Found existing credentials:");
      for (const d of detected) {
        const label = CHANNEL_DISPLAY_NAMES[d.channel] ?? d.channel;
        success(`${label} (${d.detail})`);
        if (!enabledChannels.includes(d.channel)) {
          enabledChannels.push(d.channel);
        }
      }
      console.log("");
    } else {
      info("No existing credentials found. Let's set up channels.");
    }

    // ── Step 3: Configure unconfigured channels ──
    heading("3/4  Channel Setup");
    let phoneNumber: string | null = null;

    // Check what's already configured
    const hasTwilio = detected.some(
      (d) => d.channel === "sms" || d.channel === "voice",
    );
    const hasTelegram = detected.some((d) => d.channel === "telegram");
    const hasDiscord = detected.some((d) => d.channel === "discord");
    const hasSlack = detected.some((d) => d.channel === "slack");
    const hasEmail = detected.some((d) => d.channel === "email");

    // Twilio (SMS + Voice + WhatsApp) — default Y
    if (!hasTwilio) {
      console.log("");
      if (await confirm(rl, "Set up SMS, Voice & WhatsApp via Twilio?")) {
        phoneNumber = await provisionTwilio(rl, agentUrl);
        if (phoneNumber) {
          enabledChannels.push("sms", "voice", "whatsapp");
          console.log("");
          success(
            `3 channels live with one number: ${formatPhone(phoneNumber)}`,
          );
        }
      }
    } else {
      phoneNumber = (await getCredential("sms", "phone_number")) ?? null;
    }

    // Telegram — default Y (free)
    if (!hasTelegram) {
      console.log("");
      if (await confirm(rl, "Set up a Telegram bot? (free)")) {
        if (await setupTelegramGuided(rl, name)) {
          enabledChannels.push("telegram");
        }
      }
    }

    // Discord — default Y (free)
    if (!hasDiscord) {
      console.log("");
      if (await confirm(rl, "Set up a Discord bot? (free)")) {
        if (await setupDiscord(rl)) {
          enabledChannels.push("discord");
        }
      }
    }

    // Slack — default N (requires app creation)
    if (!hasSlack) {
      console.log("");
      if (await confirm(rl, "Set up a Slack app?", false)) {
        if (await setupSlackOAuth(rl, name)) {
          enabledChannels.push("slack");
        }
      }
    }

    // Email — default N
    if (!hasEmail) {
      console.log("");
      if (await confirm(rl, "Set up email via SendGrid?", false)) {
        if (await setupEmail(rl)) {
          enabledChannels.push("email");
        }
      }
    }

    // ── Step 4: Save everything ──
    heading("4/4  Saving");

    const channelsMap: Record<string, { enabled: boolean }> = {};
    for (const ch of [...new Set(enabledChannels)]) {
      channelsMap[ch] = { enabled: true };
    }

    const identity: Identity = {
      name,
      tagline: tagline || undefined,
      version: existingIdentity?.version ?? "1.0.0",
      agent_url: agentUrl || undefined,
      channels: channelsMap as Identity["channels"],
    };

    await writeIdentity(identityPath, identity);
    success(`IDENTITY.md written to ${identityPath}`);

    const config = AgentDialConfigSchema.parse({
      identityFile: identityPath,
      agentUrl: agentUrl || undefined,
    });
    await saveConfig(config);
    success("Config saved to ~/.agentdial/config.json");

    // ── Summary — complete identity with all live channels ──
    const unique = [...new Set(enabledChannels)];
    const channelLines = unique.map((ch) => {
      const label = CHANNEL_DISPLAY_NAMES[ch] ?? ch;
      const isFree = FREE_CHANNELS.has(ch);
      return `  ${chalk.green("\u2713")} ${label}${isFree ? chalk.dim(" (free)") : ""}`;
    });

    const summaryLines = [
      chalk.bold(`"${name}"`),
      tagline ? chalk.dim(tagline) : "",
      "",
      `${unique.length} channel${unique.length > 1 ? "s" : ""} live:`,
      ...channelLines,
    ];

    if (phoneNumber) {
      summaryLines.push("", chalk.bold(`Phone: ${formatPhone(phoneNumber)}`));
      summaryLines.push(chalk.dim("Text it to say hello!"));
    }

    summaryLines.push(
      "",
      "Next:",
      "  agentdial serve   -- start the gateway",
      "  agentdial test    -- send a test message",
      "  agentdial status  -- view your identity",
    );

    console.log("");
    box("Setup Complete", summaryLines.filter(Boolean).join("\n"));
  } finally {
    rl.close();
  }
}
