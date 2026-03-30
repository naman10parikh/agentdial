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

export const SUPPORTED_CHANNELS = [
  "telegram",
  "discord",
  "slack",
  "sms",
  "whatsapp",
  "email",
  "voice",
  "teams",
  "messenger",
  "web",
] as const;

export const FREE_CHANNELS: ReadonlySet<string> = new Set([
  "telegram",
  "discord",
  "web",
]);

export const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  telegram: "Telegram Bot",
  discord: "Discord Bot",
  slack: "Slack App",
  sms: "SMS (Twilio)",
  whatsapp: "WhatsApp (Twilio)",
  email: "Email (SendGrid)",
  voice: "Voice (Twilio)",
  teams: "Microsoft Teams",
  messenger: "Facebook Messenger",
  web: "Web Widget",
};

export const CHANNEL_SETUP_TIMES: Record<string, string> = {
  telegram: "2 min",
  discord: "3 min",
  slack: "5 min",
  sms: "5 min",
  whatsapp: "10 min",
  email: "3 min",
  voice: "5 min",
  teams: "10 min",
  messenger: "10 min",
  web: "1 min",
};
