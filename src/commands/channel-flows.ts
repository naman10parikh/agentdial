import { exec } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { platform } from "node:os";
import chalk from "chalk";
import { saveCredential } from "../lib/credentials.js";
import { TelegramAdapter } from "../adapters/telegram.js";
import { success, error, info, warn, box } from "../lib/ui.js";
import { CHANNEL_DISPLAY_NAMES } from "../lib/constants.js";

// ── Shared Helpers ──

type RL = ReturnType<typeof createInterface>;

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`, () => {
    /* intentionally silent — browser open is best-effort */
  });
}

async function ask(rl: RL, prompt: string): Promise<string> {
  return (await rl.question(`  ${prompt} `)).trim();
}

async function confirm(rl: RL, prompt: string): Promise<boolean> {
  const answer = await ask(rl, `${prompt} (y/n)`);
  return answer.toLowerCase().startsWith("y");
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

// ── Twilio (SMS / WhatsApp / Voice) ──

export async function setupTwilio(
  rl: RL,
  channel: "sms" | "whatsapp" | "voice",
): Promise<boolean> {
  const label = CHANNEL_DISPLAY_NAMES[channel] ?? channel;
  info("Opening Twilio Console...");
  openBrowser("https://console.twilio.com");

  box(
    `${label} Setup (Twilio)`,
    [
      "1. Log in to your Twilio Console",
      "2. Copy your Account SID from the dashboard",
      "3. Copy your Auth Token (click to reveal)",
      "4. Get a phone number from Phone Numbers > Manage",
      ...(channel === "whatsapp"
        ? ["5. Enable WhatsApp sandbox in Messaging > Try it Out"]
        : []),
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
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
        },
      },
    );
    if (!res.ok) {
      error(`Invalid credentials: ${res.statusText}`);
      return false;
    }
    const acct = (await res.json()) as {
      friendly_name: string;
      status: string;
    };
    success(`Account: ${acct.friendly_name} (${acct.status})`);
  } catch (err) {
    error(
      `Validation failed: ${err instanceof Error ? err.message : "network error"}`,
    );
    return false;
  }

  await saveCredential(channel, "account_sid", sid);
  await saveCredential(channel, "auth_token", authToken);

  const phone = await ask(rl, "Paste phone number (+1234567890):");
  if (phone) {
    await saveCredential(channel, "phone_number", phone);
    success(`Phone number saved: ${phone}`);
  }
  return true;
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
