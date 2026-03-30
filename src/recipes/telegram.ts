import { getCredential, listCredentials } from "../lib/credentials.js";
import { loadConfig } from "../lib/config.js";
import type { Recipe } from "./types.js";

export const telegramRecipe: Recipe = {
  channel: "telegram",
  name: "Telegram Bot",
  frictionTier: 1,
  cost: { setup: "FREE", monthly: "FREE", perMessage: "FREE" },

  prerequisites: [
    {
      name: "Telegram account",
      description: "You need a Telegram account to create a bot via @BotFather",
      check: async () => {
        // Can't programmatically verify — assume true if credentials exist
        const creds = await listCredentials("telegram");
        return creds.includes("bot_token");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Open Telegram, search for @BotFather, send /newbot, follow the prompts to name your bot.",
    },
    {
      automated: false,
      instruction:
        "Copy the bot token from BotFather's response (looks like 123456789:ABCdefGhIJKlmNOPQRSTuvwxyz).",
    },
    {
      automated: true,
      instruction: "Save the bot token to agentdial credentials.",
      action: async () => {
        // This step is executed via the recipe runner which prompts for the token
        // and calls saveCredential. The action here is a placeholder —
        // the runner handles credential collection.
      },
    },
    {
      automated: true,
      instruction: "Register webhook URL with Telegram Bot API.",
      action: async () => {
        const token = await getCredential("telegram", "bot_token");
        if (!token) throw new Error("bot_token not found in credentials");

        const config = await loadConfig();
        const port = config.gatewayPort ?? 3141;
        // Webhook registration happens when serve --tunnel is run.
        // This step validates the token is valid by calling getMe.
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        if (!res.ok) {
          throw new Error(
            `Telegram API error: ${res.status} ${res.statusText}`,
          );
        }
        const data = (await res.json()) as {
          ok: boolean;
          result?: { username?: string };
        };
        if (!data.ok) {
          throw new Error("Telegram bot token is invalid");
        }
      },
    },
  ],

  verify: async () => {
    const token = await getCredential("telegram", "bot_token");
    if (!token) {
      return {
        ok: false,
        channel: "telegram",
        error: "No bot_token configured",
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      if (!res.ok) {
        return {
          ok: false,
          channel: "telegram",
          error: `Telegram API returned ${String(res.status)}`,
        };
      }
      const data = (await res.json()) as {
        ok: boolean;
        result?: { username?: string; first_name?: string };
      };
      if (!data.ok) {
        return { ok: false, channel: "telegram", error: "Token invalid" };
      }
      const username = data.result?.username ?? "unknown";
      return {
        ok: true,
        channel: "telegram",
        details: `Bot @${username} is live`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "telegram",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
