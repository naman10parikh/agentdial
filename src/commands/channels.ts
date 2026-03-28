import chalk from "chalk";
import { ChannelTypeSchema } from "../adapters/types.js";
import type { ChannelType } from "../adapters/types.js";
import {
  saveCredential,
  listCredentials,
  listConfiguredChannels,
} from "../lib/credentials.js";
import { loadConfig, updateConfig } from "../lib/config.js";
import { hasAdapter, getAdapter } from "../adapters/index.js";
import { success, error, info, warn, heading, table } from "../lib/ui.js";
import {
  SUPPORTED_CHANNELS,
  FREE_CHANNELS,
  CHANNEL_DISPLAY_NAMES,
  CHANNEL_SETUP_TIMES,
} from "../lib/constants.js";

function validateChannel(channel: string): ChannelType {
  const result = ChannelTypeSchema.safeParse(channel);
  if (!result.success) {
    error(`Unknown channel: ${channel}`);
    info(`Supported: ${SUPPORTED_CHANNELS.join(", ")}`);
    process.exit(1);
  }
  return result.data;
}

export async function cmdChannelAdd(rawChannel: string): Promise<void> {
  const channel = validateChannel(rawChannel);
  heading(`Add Channel: ${CHANNEL_DISPLAY_NAMES[channel] ?? channel}`);

  const isFree = FREE_CHANNELS.has(channel);
  info(`Setup time: ${CHANNEL_SETUP_TIMES[channel] ?? "unknown"}`);
  info(
    `Cost: ${isFree ? chalk.green("Free") : chalk.yellow("Requires paid API")}`,
  );

  const requiredCreds = getRequiredCredentials(channel);

  if (requiredCreds.length > 0) {
    info(`Required credentials: ${requiredCreds.join(", ")}`);
    warn(
      "Set credentials with environment variables or `agentdial channels add`.",
    );

    for (const key of requiredCreds) {
      const envKey = `AGENTDIAL_${channel.toUpperCase()}_${key.toUpperCase()}`;
      const value = process.env[envKey];
      if (value) {
        await saveCredential(channel, key, value);
        success(`Loaded ${key} from ${envKey}`);
      } else {
        warn(`Missing: ${envKey} — set this before connecting.`);
      }
    }
  }

  const config = await loadConfig();
  const channels = config.channels ?? {};
  channels[channel] = {
    channel,
    enabled: true,
  };
  await updateConfig({ channels });

  success(`Channel ${channel} added and enabled.`);
}

export async function cmdChannelRemove(rawChannel: string): Promise<void> {
  const channel = validateChannel(rawChannel);

  const config = await loadConfig();
  const channels = config.channels ?? {};

  if (!channels[channel]) {
    warn(`Channel ${channel} is not configured.`);
    return;
  }

  channels[channel] = { ...channels[channel], channel, enabled: false };
  await updateConfig({ channels });
  success(`Channel ${channel} disabled.`);
}

export async function cmdChannelList(): Promise<void> {
  heading("Configured Channels");

  const configured = await listConfiguredChannels();
  const config = await loadConfig();
  const channelConfigs = config.channels ?? {};

  const rows = SUPPORTED_CHANNELS.map((ch) => {
    const isConfigured = configured.includes(ch);
    const isEnabled = channelConfigs[ch]?.enabled ?? false;
    const isFree = FREE_CHANNELS.has(ch);

    return {
      Channel: CHANNEL_DISPLAY_NAMES[ch] ?? ch,
      Status: isEnabled
        ? chalk.green("enabled")
        : isConfigured
          ? chalk.yellow("disabled")
          : chalk.dim("not configured"),
      Cost: isFree ? chalk.green("free") : chalk.dim("paid"),
      Setup: CHANNEL_SETUP_TIMES[ch] ?? "—",
    };
  });

  table(["Channel", "Status", "Cost", "Setup"], rows);
}

export async function cmdChannelTest(rawChannel?: string): Promise<void> {
  if (rawChannel) {
    const channel = validateChannel(rawChannel);
    heading(`Testing: ${CHANNEL_DISPLAY_NAMES[channel] ?? channel}`);

    const creds = await listCredentials(channel);
    if (creds.length === 0) {
      error("No credentials configured. Run `agentdial channels add` first.");
      return;
    }

    if (!hasAdapter(channel)) {
      warn(
        `No adapter available for ${channel}. Credentials found: ${creds.join(", ")}`,
      );
      return;
    }

    const adapter = getAdapter(channel);
    try {
      await adapter.setup({ channel, enabled: true });
      const result = await adapter.test();
      if (result.ok) {
        success(`${CHANNEL_DISPLAY_NAMES[channel] ?? channel}: connected`);
      } else {
        error(
          `${CHANNEL_DISPLAY_NAMES[channel] ?? channel}: ${result.error ?? "test failed"}`,
        );
      }
    } catch (err) {
      error(
        `${CHANNEL_DISPLAY_NAMES[channel] ?? channel}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
    return;
  }

  heading("Testing All Channels");
  const configured = await listConfiguredChannels();

  if (configured.length === 0) {
    warn(
      "No channels configured. Run `agentdial channels add <channel>` first.",
    );
    return;
  }

  const rows: { Channel: string; Status: string; Details: string }[] = [];

  for (const ch of configured) {
    const displayName = CHANNEL_DISPLAY_NAMES[ch] ?? ch;
    const creds = await listCredentials(ch);

    if (creds.length === 0) {
      rows.push({
        Channel: displayName,
        Status: chalk.yellow("no creds"),
        Details: "Run `agentdial channels add`",
      });
      continue;
    }

    if (!hasAdapter(ch)) {
      rows.push({
        Channel: displayName,
        Status: chalk.dim("no adapter"),
        Details: `${String(creds.length)} credentials stored`,
      });
      continue;
    }

    const adapter = getAdapter(ch);
    try {
      await adapter.setup({ channel: ch, enabled: true });
      const result = await adapter.test();
      if (result.ok) {
        rows.push({
          Channel: displayName,
          Status: chalk.green("ok"),
          Details: "Connected",
        });
      } else {
        rows.push({
          Channel: displayName,
          Status: chalk.red("fail"),
          Details: result.error ?? "test failed",
        });
      }
    } catch (err) {
      rows.push({
        Channel: displayName,
        Status: chalk.red("error"),
        Details: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  table(["Channel", "Status", "Details"], rows);
}

function getRequiredCredentials(channel: ChannelType): string[] {
  switch (channel) {
    case "telegram":
      return ["bot_token"];
    case "discord":
      return ["bot_token", "application_id"];
    case "slack":
      return ["bot_token", "app_token", "signing_secret"];
    case "sms":
    case "whatsapp":
    case "voice":
      return ["account_sid", "auth_token", "phone_number"];
    case "email":
      return ["api_key", "from_email"];
    case "teams":
      return ["app_id", "app_password"];
    case "messenger":
      return ["page_token", "verify_token", "app_secret"];
    case "web":
      return [];
  }
}
