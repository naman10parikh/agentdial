import chalk from "chalk";
import { loadConfig } from "../lib/config.js";
import { listConfiguredChannels, listCredentials } from "../lib/credentials.js";
import { parseIdentity } from "../lib/identity.js";
import { banner, heading, table, info, success, warn } from "../lib/ui.js";
import { CHANNEL_DISPLAY_NAMES, FREE_CHANNELS } from "../lib/constants.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
export async function cmdStatus(opts) {
  const config = await loadConfig();
  const identityPath = resolve(config.identityFile);
  const configured = await listConfiguredChannels();
  // Identity
  let identityStatus = null;
  if (existsSync(identityPath)) {
    try {
      const identity = await parseIdentity(identityPath);
      const enabledCount = Object.values(identity.channels ?? {}).filter(
        (c) => c.enabled,
      ).length;
      identityStatus = {
        name: identity.name,
        version: identity.version,
        channels: enabledCount,
      };
    } catch {
      identityStatus = null;
    }
  }
  // Channels
  const channelStatuses = [];
  for (const ch of configured) {
    const creds = await listCredentials(ch);
    const chConfig = config.channels?.[ch];
    channelStatuses.push({
      name: ch,
      enabled: chConfig?.enabled ?? false,
      credentials: creds.length,
    });
  }
  const output = {
    identity: identityStatus,
    channels: channelStatuses,
    gateway: {
      configured: !!config.agentUrl,
      port: config.gatewayPort,
      agentUrl: config.agentUrl ?? null,
    },
  };
  if (opts.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  banner();
  heading("Identity");
  if (identityStatus) {
    success(`${identityStatus.name} v${identityStatus.version}`);
    info(`${String(identityStatus.channels)} channels enabled in IDENTITY.md`);
  } else {
    warn("No IDENTITY.md found. Run `agentdial setup` to create one.");
  }
  heading("Channels");
  if (channelStatuses.length === 0) {
    info("No channels configured.");
  } else {
    const rows = channelStatuses.map((ch) => ({
      Channel: CHANNEL_DISPLAY_NAMES[ch.name] ?? ch.name,
      Status: ch.enabled ? chalk.green("enabled") : chalk.yellow("disabled"),
      Credentials:
        ch.credentials > 0
          ? chalk.green(`${String(ch.credentials)} keys`)
          : chalk.red("none"),
      Cost: FREE_CHANNELS.has(ch.name) ? "free" : "paid",
    }));
    table(["Channel", "Status", "Credentials", "Cost"], rows);
  }
  heading("Gateway");
  if (config.agentUrl) {
    success(`Agent URL: ${config.agentUrl}`);
  } else {
    warn("No agent URL configured.");
  }
  info(`Port: ${String(config.gatewayPort)}`);
}
//# sourceMappingURL=status.js.map
