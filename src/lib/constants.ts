import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "1.2.1";

export const CONFIG_DIR = join(homedir(), ".agentdial");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const CREDENTIALS_DIR = join(CONFIG_DIR, "credentials");
export const TEMPLATES_DIR = join(CONFIG_DIR, "templates");
export const LOGS_DIR = join(CONFIG_DIR, "logs");

export const DEFAULT_GATEWAY_PORT = 3141;
export const DEFAULT_IDENTITY_FILE = "IDENTITY.md";

/**
 * Channel definitions — kept in sync with the web connector registry.
 * Source of truth: packages/web/src/lib/connectors/registry.ts
 *
 * When adding or changing channels, update the web registry first,
 * then mirror the changes here.
 */

export const SUPPORTED_CHANNELS = [
  "email",
  "telegram",
  "discord",
  "slack",
  "sms",
  "voice",
  "whatsapp",
  "imessage",
  "web",
] as const;

/** Pricing tiers — mirrors ChannelTier from the web registry */
export type ChannelTier = "free" | "pro" | "premium";

export const CHANNEL_TIERS: Record<string, ChannelTier> = {
  email: "free",
  telegram: "free",
  discord: "free",
  slack: "free",
  sms: "pro",
  voice: "pro",
  whatsapp: "pro",
  imessage: "premium",
  web: "free",
};

export const FREE_CHANNELS: ReadonlySet<string> = new Set(
  Object.entries(CHANNEL_TIERS)
    .filter(([, tier]) => tier === "free")
    .map(([id]) => id),
);

export const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  email: "Email",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  sms: "Messaging (SMS)",
  voice: "Voice",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
  web: "Web Widget",
};

export const CHANNEL_COSTS: Record<string, string> = {
  email: "Free",
  telegram: "Free",
  discord: "Free",
  slack: "Free",
  sms: "$1.15/mo",
  voice: "$0.014/min",
  whatsapp: "Free (2K msgs/mo)",
  imessage: "$289/mo",
  web: "Free",
};

export const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  email: "Your agent gets its own email inbox",
  telegram: "Telegram bot messaging",
  discord: "Add your agent to any Discord server",
  slack: "Add your agent to any Slack workspace",
  sms: "Works on all phones — iPhone, Android, any carrier",
  voice: "Call your agent — uses SMS number",
  whatsapp: "One click — connect via Facebook login (powered by Kapso)",
  imessage: "Premium — blue bubbles via Blooio managed relay",
  web: "Embeddable chat widget for your website",
};

export const CHANNEL_SETUP_TIMES: Record<string, string> = {
  email: "2 min",
  telegram: "60 seconds",
  discord: "1 click",
  slack: "1 click",
  sms: "1 click",
  voice: "Auto",
  whatsapp: "1 click",
  imessage: "5 min",
  web: "1 min",
};

export const CHANNEL_PROVIDERS: Record<string, string> = {
  email: "AgentMail",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  sms: "Twilio",
  voice: "Twilio",
  whatsapp: "Kapso",
  imessage: "Blooio",
  web: "Built-in",
};
