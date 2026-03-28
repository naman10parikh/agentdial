import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseIdentity, writeIdentity } from "../lib/identity.js";
import { ensureConfigDir, saveConfig } from "../lib/config.js";
import { saveCredential } from "../lib/credentials.js";
import { banner, success, info, error, heading, box } from "../lib/ui.js";
import {
  DEFAULT_IDENTITY_FILE,
  CHANNEL_DISPLAY_NAMES,
} from "../lib/constants.js";
import { AgentDialConfigSchema } from "../adapters/types.js";
import { existsSync } from "node:fs";
const TWILIO_CREDS = [
  { key: "account_sid", prompt: "Paste your Twilio Account SID:" },
  { key: "auth_token", prompt: "Paste your Twilio Auth Token:", secret: true },
  { key: "phone_number", prompt: "Paste your Twilio Phone Number:" },
];
/* prettier-ignore */
const CHANNEL_MENU = [
    // Free channels
    { key: "telegram", display: "Telegram Bot", free: true, cost: "free", time: "2 min", credentials: [{ key: "bot_token", prompt: "Paste your Bot Token from @BotFather:", secret: true }] },
    { key: "discord", display: "Discord Bot", free: true, cost: "free", time: "3 min", credentials: [{ key: "bot_token", prompt: "Paste your Bot Token from Discord Developer Portal:", secret: true }] },
    { key: "web", display: "Web Widget", free: true, cost: "free", time: "1 min", credentials: [] },
    // Paid channels
    { key: "sms", display: "SMS (Twilio)", free: false, cost: "$1.15/mo", time: "5 min", credentials: TWILIO_CREDS },
    { key: "whatsapp", display: "WhatsApp (Twilio)", free: false, cost: "$5/mo via Twilio", time: "10 min", credentials: TWILIO_CREDS },
    { key: "email", display: "Email (SendGrid)", free: false, cost: "free tier: 100/day", time: "3 min", credentials: [{ key: "api_key", prompt: "Paste your SendGrid API Key:", secret: true }, { key: "from_email", prompt: "Sender email address:" }] },
    { key: "voice", display: "Voice (Twilio)", free: false, cost: "$0.05/min", time: "5 min", credentials: TWILIO_CREDS },
    { key: "slack", display: "Slack App", free: false, cost: "free tier", time: "5 min", credentials: [{ key: "bot_token", prompt: "Paste your Slack Bot Token (xoxb-...):", secret: true }, { key: "app_token", prompt: "Paste your Slack App Token (xapp-...):", secret: true }] },
    { key: "teams", display: "Microsoft Teams", free: false, cost: "free", time: "10 min", credentials: [{ key: "app_id", prompt: "Paste your Teams App ID:" }, { key: "app_password", prompt: "Paste your Teams App Password:", secret: true }], comingSoon: true },
    { key: "messenger", display: "Facebook Messenger", free: false, cost: "free", time: "10 min", credentials: [{ key: "page_token", prompt: "Paste your Page Access Token:", secret: true }, { key: "verify_token", prompt: "Choose a Verify Token string:" }], comingSoon: true },
];
// ── Helpers ──
async function ask(rl, prompt, fallback) {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`  ${prompt}${suffix} `)).trim();
  return answer || fallback || "";
}
function formatChannelLine(idx, ch) {
  const num = String(idx + 1).padStart(2);
  if (ch.comingSoon) {
    return `  ${num}) ${ch.display.padEnd(22)} (Coming Soon)`;
  }
  const cost = ch.free ? "free" : ch.cost;
  return `  ${num}) ${ch.display.padEnd(22)} (${cost}, ${ch.time} setup)`;
}
// ── Main ──
export async function cmdSetup(opts) {
  banner();
  heading("Interactive Setup");
  await ensureConfigDir();
  const identityPath = resolve(opts.file ?? DEFAULT_IDENTITY_FILE);
  let existingIdentity = null;
  if (existsSync(identityPath)) {
    try {
      existingIdentity = await parseIdentity(identityPath);
      info(`Found existing identity: ${existingIdentity.name}`);
    } catch {
      // Corrupt file — we'll overwrite it
    }
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    // ── Step 1: Agent basics ──
    heading("1/4  Agent Identity");
    const name = await ask(
      rl,
      "What's your agent's name?",
      existingIdentity?.name ?? "Spark",
    );
    if (!name) {
      error("Agent name is required.");
      return;
    }
    const tagline = await ask(
      rl,
      "What does your agent do? (tagline)",
      existingIdentity?.tagline ?? "An AI assistant",
    );
    const agentUrl = await ask(
      rl,
      "Where is your agent's backend? (URL)",
      existingIdentity?.agent_url ?? "http://localhost:3000/api/chat",
    );
    // ── Step 2: Channel selection ──
    heading("2/4  Select Channels");
    console.log("");
    console.log("  FREE CHANNELS:");
    const freeChannels = CHANNEL_MENU.filter((c) => c.free);
    const paidChannels = CHANNEL_MENU.filter((c) => !c.free);
    for (let i = 0; i < freeChannels.length; i++) {
      console.log(formatChannelLine(i, freeChannels[i]));
    }
    console.log("");
    console.log("  PAID CHANNELS:");
    for (let i = 0; i < paidChannels.length; i++) {
      console.log(formatChannelLine(freeChannels.length + i, paidChannels[i]));
    }
    console.log("");
    const allOrdered = [...freeChannels, ...paidChannels];
    const selectionRaw = await ask(
      rl,
      "Enter channel numbers, comma-separated (e.g. 1,2,5):",
      "1",
    );
    const selectedIndices = selectionRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((n) => !isNaN(n) && n >= 0 && n < allOrdered.length);
    const selectedChannels = [...new Set(selectedIndices)]
      .map((i) => allOrdered[i])
      .filter((ch) => {
        if (ch.comingSoon) {
          info(`  ${ch.display} is coming soon — skipped.`);
          return false;
        }
        return true;
      });
    if (selectedChannels.length === 0) {
      info(
        "No channels selected. You can add them later with `agentdial channels add`.",
      );
    } else {
      success(`Selected: ${selectedChannels.map((c) => c.display).join(", ")}`);
    }
    // ── Step 3: Channel credentials ──
    const channelsWithCreds = selectedChannels.filter(
      (c) => c.credentials.length > 0,
    );
    if (channelsWithCreds.length > 0) {
      heading("3/4  Channel Credentials");
      info("Credentials are stored locally in ~/.agentdial/credentials/");
      console.log("");
      for (const channel of channelsWithCreds) {
        console.log(
          `  ${CHANNEL_DISPLAY_NAMES[channel.key] ?? channel.display}:`,
        );
        for (const cred of channel.credentials) {
          const value = await ask(rl, cred.prompt);
          if (value) {
            await saveCredential(channel.key, cred.key, value);
          } else {
            info(
              `  Skipped ${cred.key} — set it later with \`agentdial channels add ${channel.key}\``,
            );
          }
        }
        console.log("");
      }
    } else {
      heading("3/4  Channel Credentials");
      info("No credentials needed for selected channels.");
    }
    // ── Step 4: Generate identity + config ──
    heading("4/4  Saving Configuration");
    const channelsMap = {};
    for (const ch of selectedChannels) {
      channelsMap[ch.key] = { enabled: true };
    }
    const identity = {
      name,
      tagline: tagline || undefined,
      version: existingIdentity?.version ?? "1.0.0",
      agent_url: agentUrl || undefined,
      channels: channelsMap,
    };
    await writeIdentity(identityPath, identity);
    success(`IDENTITY.md written to ${identityPath}`);
    const config = AgentDialConfigSchema.parse({
      identityFile: identityPath,
      agentUrl: agentUrl || undefined,
    });
    await saveConfig(config);
    success("Config saved to ~/.agentdial/config.json");
    // ── Summary ──
    console.log("");
    const enabledNames = selectedChannels.map((c) => c.display);
    const channelLine =
      enabledNames.length > 0
        ? `${enabledNames.length} channels enabled: ${enabledNames.join(", ")}`
        : "No channels enabled yet";
    box(
      "Setup Complete",
      [
        `Agent "${name}" configured!`,
        channelLine,
        `IDENTITY.md created at ${identityPath}`,
        "",
        "Next steps:",
        "  agentdial test    -- send a test message",
        "  agentdial serve   -- start the gateway",
        "  agentdial status  -- view your identity",
      ].join("\n"),
    );
  } finally {
    rl.close();
  }
}
//# sourceMappingURL=setup.js.map
