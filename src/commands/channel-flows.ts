import { exec } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { platform } from "node:os";
import chalk from "chalk";
import { saveCredential, getCredential } from "../lib/credentials.js";
import { TelegramAdapter } from "../adapters/telegram.js";
import { success, error, info, warn, box } from "../lib/ui.js";
import { CHANNEL_DISPLAY_NAMES } from "../lib/constants.js";
import {
  validateTwilioAccount,
  searchTwilioNumbers,
  buyTwilioNumber,
  formatPhone,
  validateTelegramToken,
} from "../lib/provisioning.js";
import { startOAuthFlow } from "../lib/oauth-server.js";
import {
  buildSlackManifest,
  createSlackApp,
  exchangeSlackCode,
} from "../lib/slack-manifest.js";
import type { ChannelType } from "../adapters/types.js";

// ── Shared Helpers ──

type RL = ReturnType<typeof createInterface>;

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`, () => {
    /* intentionally silent — browser open is best-effort */
  });
}

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

// ── Telegram ──

export async function setupTelegram(rl: RL): Promise<boolean> {
  info("Opening BotFather in your browser...");
  openBrowser("https://t.me/BotFather");

  box(
    "Telegram Bot Setup",
    [
      '1. Click "Start" in BotFather',
      "2. Send: /newbot",
      "3. Name your bot (e.g. My Agent)",
      "4. Choose a username (must end in _bot)",
      "",
      "BotFather will reply with a token like:",
      chalk.dim("7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PA"),
    ].join("\n"),
  );

  const token = await ask(rl, "Paste your bot token:");
  if (!token) {
    warn("No token provided. Skipping.");
    return false;
  }

  info("Validating token...");
  const result = await TelegramAdapter.validateToken(token);
  if (!result.ok) {
    error(`Invalid token: ${result.error}`);
    return false;
  }

  await saveCredential("telegram", "bot_token", token);
  success(`Connected to @${result.username} (${result.displayName})`);

  if (await confirm(rl, "Set up webhook for incoming messages?")) {
    const url = await ask(rl, "Webhook URL:");
    if (url) {
      await saveCredential("telegram", "webhook_url", url);
      success(`Webhook saved: ${url}`);
    }
  }
  return true;
}

// ── Discord ──

export async function setupDiscord(rl: RL): Promise<boolean> {
  info("Opening Discord Developer Portal...");
  openBrowser("https://discord.com/developers/applications");

  box(
    "Discord Bot Setup",
    [
      '1. Click "New Application" and name it',
      '2. Go to "Bot" in the sidebar',
      '3. Click "Reset Token" and copy it',
      "4. Enable MESSAGE CONTENT intent (toggle ON)",
      "5. Go to OAuth2 > URL Generator",
      "   Check: bot + Send Messages",
      "   Copy the invite URL to add bot to your server",
    ].join("\n"),
  );

  const token = await ask(rl, "Paste your bot token:");
  if (!token) {
    warn("No token provided. Skipping.");
    return false;
  }

  info("Validating token...");
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      error(`Invalid token: ${body.message ?? res.statusText}`);
      return false;
    }
    const bot = (await res.json()) as { username: string; id: string };
    await saveCredential("discord", "bot_token", token);
    await saveCredential("discord", "application_id", bot.id);
    success(`Connected to ${bot.username} (ID: ${bot.id})`);
  } catch (err) {
    error(
      `Validation failed: ${err instanceof Error ? err.message : "network error"}`,
    );
    return false;
  }

  const inviteUrl = await ask(
    rl,
    "Paste invite URL (optional, Enter to skip):",
  );
  if (inviteUrl) {
    await saveCredential("discord", "invite_url", inviteUrl);
    success("Invite URL saved.");
  }
  return true;
}

// ── Slack ──

export async function setupSlack(rl: RL): Promise<boolean> {
  info("Opening Slack App management...");
  openBrowser("https://api.slack.com/apps");

  box(
    "Slack App Setup",
    [
      '1. Click "Create New App" > "From scratch"',
      "2. Name it and pick your workspace",
      '3. Go to "OAuth & Permissions"',
      "   Add scopes: chat:write, channels:read, im:read",
      "4. Install to workspace, copy Bot Token (xoxb-...)",
      '5. Go to "Socket Mode", enable it',
      "   Create App-Level Token (xapp-...) with",
      "   scope: connections:write",
    ].join("\n"),
  );

  const botToken = await ask(rl, "Paste Bot Token (xoxb-...):");
  if (!botToken) {
    warn("No token provided. Skipping.");
    return false;
  }

  info("Validating bot token...");
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = (await res.json()) as {
      ok: boolean;
      user?: string;
      team?: string;
      error?: string;
    };
    if (!data.ok) {
      error(`Invalid bot token: ${data.error ?? "unknown"}`);
      return false;
    }
    success(`Connected to workspace: ${data.team} as ${data.user}`);
    await saveCredential("slack", "bot_token", botToken);
  } catch (err) {
    error(
      `Validation failed: ${err instanceof Error ? err.message : "network error"}`,
    );
    return false;
  }

  const appToken = await ask(rl, "Paste App Token (xapp-...):");
  if (appToken) {
    await saveCredential("slack", "app_token", appToken);
    success("App token saved.");
  }
  return true;
}

// ── Twilio (SMS / WhatsApp / Voice) — Auto-Provisioning ──

export async function setupTwilio(
  rl: RL,
  channel: "sms" | "whatsapp" | "voice",
): Promise<boolean> {
  const label = CHANNEL_DISPLAY_NAMES[channel] ?? channel;

  // Check for existing credentials first
  const existingSid = await getCredential("sms", "account_sid");
  const existingToken = await getCredential("sms", "auth_token");
  const existingPhone = await getCredential("sms", "phone_number");

  // Fast path: everything already configured
  if (existingSid && existingToken && existingPhone) {
    info(`Twilio already configured with ${formatPhone(existingPhone)}`);
    const valid = await validateTwilioAccount(existingSid, existingToken);
    if (valid.ok) {
      success(`${label} ready on ${formatPhone(existingPhone)}`);
      return true;
    }
    warn("Saved credentials are invalid. Re-entering...");
  }

  // Credentials exist but no phone? Offer auto-buy
  if (existingSid && existingToken && !existingPhone) {
    const valid = await validateTwilioAccount(existingSid, existingToken);
    if (valid.ok) {
      success(`Account: ${valid.name}`);
      if (await confirm(rl, "Buy a phone number? ($1.15/mo)")) {
        const phone = await autoBuyNumber(rl, existingSid, existingToken);
        return phone !== null;
      }
      // Manual entry fallback
      const phone = await ask(rl, "Paste phone number (+1234567890):");
      if (phone) {
        for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
          await saveCredential(ch, "phone_number", phone);
        }
        success(`Phone saved: ${formatPhone(phone)}`);
        return true;
      }
      return false;
    }
  }

  // Fresh setup
  info("Opening Twilio Console...");
  openBrowser("https://console.twilio.com");

  box(
    `${label} Setup (Twilio)`,
    [
      "1. Log in to your Twilio Console",
      "2. Copy your Account SID",
      "3. Copy your Auth Token",
      "",
      chalk.dim("We'll auto-buy a number for you after this."),
    ].join("\n"),
  );

  const sid = await ask(rl, "Paste Account SID (AC...):");
  if (!sid) {
    warn("No SID provided. Skipping.");
    return false;
  }

  const authToken = await ask(rl, "Paste Auth Token:");
  if (!authToken) {
    warn("No auth token provided. Skipping.");
    return false;
  }

  info("Validating credentials...");
  const validation = await validateTwilioAccount(sid, authToken);
  if (!validation.ok) {
    error(`Invalid credentials: ${validation.error}`);
    return false;
  }
  success(`Account: ${validation.name} (${validation.status})`);

  // Save for all Twilio channels
  for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
    await saveCredential(ch, "account_sid", sid);
    await saveCredential(ch, "auth_token", authToken);
  }

  // Offer auto-buy
  if (await confirm(rl, "Buy a phone number automatically? ($1.15/mo)")) {
    const phone = await autoBuyNumber(rl, sid, authToken);
    if (phone) {
      success(
        `3 channels enabled: SMS, WhatsApp, Voice on ${formatPhone(phone)}`,
      );
      return true;
    }
  }

  // Manual fallback
  const phone = await ask(rl, "Paste phone number (+1234567890):");
  if (phone) {
    for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
      await saveCredential(ch, "phone_number", phone);
    }
    success(`Phone saved: ${formatPhone(phone)}`);
  }
  return true;
}

async function autoBuyNumber(
  rl: RL,
  sid: string,
  token: string,
): Promise<string | null> {
  info("Searching for available numbers...");
  try {
    const numbers = await searchTwilioNumbers(sid, token, { limit: 3 });
    if (numbers.length === 0) {
      error("No numbers found. Buy manually at twilio.com.");
      return null;
    }

    console.log("");
    for (let i = 0; i < numbers.length; i++) {
      const n = numbers[i]!;
      console.log(
        `    ${i + 1}) ${formatPhone(n.number)}  [${n.capabilities.join(", ")}]`,
      );
    }
    console.log("");

    const pick = await ask(rl, `Pick (1-${numbers.length}):`, "1");
    const idx = parseInt(pick, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= numbers.length) {
      error("Invalid selection.");
      return null;
    }

    const chosen = numbers[idx]!;
    info(`Purchasing ${formatPhone(chosen.number)}...`);

    const result = await buyTwilioNumber(sid, token, chosen.number, "");
    for (const ch of ["sms", "whatsapp", "voice"] as ChannelType[]) {
      await saveCredential(ch, "phone_number", result.number);
    }
    success(`Purchased: ${formatPhone(result.number)}`);
    return result.number;
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    return null;
  }
}

// ── Email (SendGrid) ──

export async function setupEmail(rl: RL): Promise<boolean> {
  info("Opening SendGrid API Keys...");
  openBrowser("https://app.sendgrid.com/settings/api_keys");

  box(
    "Email Setup (SendGrid)",
    [
      '1. Click "Create API Key"',
      "2. Name: agentdial (or your agent name)",
      '3. Permissions: "Restricted Access"',
      "   Enable: Mail Send > Full Access",
      "4. Copy the key (starts with SG.)",
      "",
      chalk.dim("Free tier: 100 emails/day"),
    ].join("\n"),
  );

  const apiKey = await ask(rl, "Paste API Key (SG....):");
  if (!apiKey) {
    warn("No key provided. Skipping.");
    return false;
  }

  info("Validating API key...");
  try {
    const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      error(`Invalid API key: ${res.statusText}`);
      return false;
    }
    const profile = (await res.json()) as {
      first_name?: string;
      last_name?: string;
    };
    const name =
      `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    success(name ? `Connected: ${name}` : "Account verified");
  } catch (err) {
    error(
      `Validation failed: ${err instanceof Error ? err.message : "network error"}`,
    );
    return false;
  }

  await saveCredential("email", "api_key", apiKey);

  const fromEmail = await ask(rl, "Sender email address:");
  if (fromEmail) {
    await saveCredential("email", "from_email", fromEmail);
    success(`Sender: ${fromEmail}`);
  }
  return true;
}

// ── Slack (OAuth + Manifest) ──

export async function setupSlackOAuth(
  rl: RL,
  agentName: string,
): Promise<boolean> {
  // Check existing credentials
  const existingToken = await getCredential("slack", "bot_token");
  if (existingToken) {
    info("Found existing Slack bot token. Validating...");
    try {
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      const data = (await res.json()) as {
        ok: boolean;
        team?: string;
        user?: string;
        error?: string;
      };
      if (data.ok) {
        success(`Slack already connected: ${data.team} as ${data.user}`);
        return true;
      }
      warn(`Saved token is invalid (${data.error}). Re-configuring...`);
    } catch {
      warn("Could not validate saved token. Re-configuring...");
    }
  }

  info(`Creating Slack app "${agentName}"...`);

  // Path 1: User has a Slack configuration token (apps.manifest.create)
  const configToken = await ask(
    rl,
    "Slack config token (xoxe-...) or Enter to use OAuth:",
  );

  if (configToken) {
    try {
      const manifest = buildSlackManifest(agentName, `${agentName} agent`);
      info("Creating app via Slack Manifest API...");
      const app = await createSlackApp(configToken, manifest);
      success(`App created: ${app.appId}`);

      await saveCredential("slack", "app_id", app.appId);
      await saveCredential("slack", "client_id", app.clientId);
      await saveCredential("slack", "client_secret", app.clientSecret);

      // Now do OAuth to install to workspace
      info("Opening browser to install app to your workspace...");
      const redirectUri = "http://localhost:7891/callback";
      const scopes =
        "chat:write,channels:read,im:read,im:write,im:history,users:read";
      const authorizeUrl = `https://slack.com/oauth/v2/authorize?client_id=${app.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const oauthResult = await startOAuthFlow({
        authorizeUrl,
        port: 7891,
        timeout: 120_000,
      });

      const tokenResult = await exchangeSlackCode(
        app.clientId,
        app.clientSecret,
        oauthResult.code,
        redirectUri,
      );

      await saveCredential("slack", "bot_token", tokenResult.botToken);
      await saveCredential("slack", "team_id", tokenResult.teamId);
      await saveCredential("slack", "team_name", tokenResult.teamName);
      success(`Slack app installed in workspace: ${tokenResult.teamName}`);
      return true;
    } catch (err) {
      error(
        `Manifest creation failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      info("Falling back to manual setup...");
    }
  }

  // Path 2: Manual setup (existing flow as fallback)
  return setupSlack(rl);
}

// ── Telegram (Improved Guided Setup) ──

export async function setupTelegramGuided(
  rl: RL,
  agentName: string,
): Promise<boolean> {
  // Check existing credentials
  const existing = await getCredential("telegram", "bot_token");
  if (existing) {
    info("Found existing Telegram bot token. Validating...");
    const result = await validateTelegramToken(existing);
    if (result.ok) {
      success(`Telegram bot: @${result.username} (${result.displayName})`);
      return true;
    }
    warn("Saved token is invalid. Setting up a new bot...");
  }

  // Open BotFather deep link (works on desktop Telegram)
  info("Opening BotFather in Telegram...");
  openBrowser("https://t.me/BotFather?start=");

  const botUsername = `${agentName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_bot`;

  box(
    "Telegram Bot Setup",
    [
      "Copy-paste these messages to BotFather:",
      "",
      chalk.bold("Step 1:") + " Send:",
      chalk.cyan("  /newbot"),
      "",
      chalk.bold("Step 2:") + " Send the display name:",
      chalk.cyan(`  ${agentName}`),
      "",
      chalk.bold("Step 3:") + " Send the username:",
      chalk.cyan(`  ${botUsername}`),
      "",
      chalk.dim("BotFather will reply with a token like:"),
      chalk.dim("7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PA"),
    ].join("\n"),
  );

  const token = await ask(rl, "Paste your bot token:");
  if (!token) {
    warn("No token provided. Skipping.");
    return false;
  }

  info("Validating via /getMe...");
  const result = await validateTelegramToken(token);
  if (!result.ok) {
    error(`Invalid token: ${result.error}`);
    return false;
  }

  await saveCredential("telegram", "bot_token", token);
  success(`Connected to @${result.username} (${result.displayName})`);
  return true;
}
