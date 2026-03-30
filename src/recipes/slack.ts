import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

export const slackRecipe: Recipe = {
  channel: "slack",
  name: "Slack App",
  frictionTier: 2,
  cost: { setup: "FREE", monthly: "FREE", perMessage: "FREE" },

  prerequisites: [
    {
      name: "Slack workspace",
      description: "You need admin access to a Slack workspace to install apps",
      check: async () => {
        const creds = await listCredentials("slack");
        return creds.includes("bot_token");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Go to https://api.slack.com/apps and click 'Create New App' → 'From scratch'.",
    },
    {
      automated: false,
      instruction:
        "Name your app, select your workspace, then go to 'OAuth & Permissions'.",
    },
    {
      automated: false,
      instruction:
        "Add Bot Token Scopes: chat:write, app_mentions:read, im:history, im:read, im:write. Then click 'Install to Workspace' and authorize.",
    },
    {
      automated: false,
      instruction:
        "Copy the 'Bot User OAuth Token' (starts with xoxb-) from the OAuth & Permissions page.",
    },
    {
      automated: false,
      instruction:
        "Go to 'Basic Information' → copy the 'Signing Secret' for webhook validation.",
    },
    {
      automated: false,
      instruction:
        "Enable Socket Mode: go to 'Socket Mode' → toggle on → create an App-Level Token with 'connections:write' scope.",
    },
    {
      automated: true,
      instruction:
        "Save bot token and signing secret to agentdial credentials.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: true,
      instruction: "Verify Slack bot token via auth.test API.",
      action: async () => {
        const token = await getCredential("slack", "bot_token");
        if (!token) throw new Error("bot_token not found in credentials");

        const res = await fetch("https://slack.com/api/auth.test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) {
          throw new Error(`Slack auth.test failed: ${data.error ?? "unknown"}`);
        }
      },
    },
  ],

  verify: async () => {
    const token = await getCredential("slack", "bot_token");
    if (!token) {
      return { ok: false, channel: "slack", error: "No bot_token configured" };
    }

    try {
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        user?: string;
        team?: string;
      };
      if (!data.ok) {
        return {
          ok: false,
          channel: "slack",
          error: `auth.test failed: ${data.error ?? "unknown"}`,
        };
      }
      return {
        ok: true,
        channel: "slack",
        details: `Bot authenticated in workspace ${data.team ?? "unknown"}`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "slack",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
