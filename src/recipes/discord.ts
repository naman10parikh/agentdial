import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

export const discordRecipe: Recipe = {
  channel: "discord",
  name: "Discord Bot",
  frictionTier: 2,
  cost: { setup: "FREE", monthly: "FREE", perMessage: "FREE" },

  prerequisites: [
    {
      name: "Discord account",
      description: "You need a Discord account to access the Developer Portal",
      check: async () => {
        const creds = await listCredentials("discord");
        return creds.includes("bot_token");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Go to https://discord.com/developers/applications and click 'New Application'.",
    },
    {
      automated: false,
      instruction:
        "Name your application, then go to Bot tab → click 'Reset Token' → copy the bot token.",
    },
    {
      automated: false,
      instruction:
        "Under Bot settings, enable 'Message Content Intent' (required for reading messages).",
    },
    {
      automated: false,
      instruction:
        "Go to OAuth2 → URL Generator → select 'bot' scope → select 'Send Messages' + 'Read Message History' permissions → copy the invite URL and open it to add the bot to your server.",
    },
    {
      automated: true,
      instruction:
        "Save the bot token and application ID to agentdial credentials.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: true,
      instruction: "Verify bot token by connecting to Discord Gateway.",
      action: async () => {
        const token = await getCredential("discord", "bot_token");
        if (!token) throw new Error("bot_token not found in credentials");

        // Validate token via Discord REST API
        const res = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${token}` },
        });
        if (!res.ok) {
          throw new Error(
            `Discord API error: ${res.status} — token may be invalid`,
          );
        }
      },
    },
  ],

  verify: async () => {
    const token = await getCredential("discord", "bot_token");
    if (!token) {
      return {
        ok: false,
        channel: "discord",
        error: "No bot_token configured",
      };
    }

    try {
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) {
        return {
          ok: false,
          channel: "discord",
          error: `Discord API returned ${String(res.status)}`,
        };
      }
      const data = (await res.json()) as {
        username?: string;
        discriminator?: string;
      };
      const name = data.username ?? "unknown";
      return {
        ok: true,
        channel: "discord",
        details: `Bot ${name} is authenticated`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "discord",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
