import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

/**
 * Email recipe — friction varies by provider:
 *   - AgentMail (tier 0): zero-config, API-only
 *   - Resend (tier 1): paste API key
 *   - SendGrid (tier 3): account + domain verification
 *
 * Default recipe covers SendGrid (most common).
 * AgentMail will be a separate recipe when the service launches.
 */
export const emailRecipe: Recipe = {
  channel: "email",
  name: "Email (SendGrid)",
  frictionTier: 3,
  cost: {
    setup: "FREE (trial)",
    monthly: "$19.95 (after trial)",
    perMessage: "100/day free trial",
  },

  prerequisites: [
    {
      name: "SendGrid account",
      description:
        "Sign up at https://sendgrid.com — 60-day trial with 100 emails/day. After trial: $19.95/mo minimum.",
      check: async () => {
        const creds = await listCredentials("email");
        return creds.includes("api_key");
      },
    },
    {
      name: "Verified sender email",
      description:
        "SendGrid requires a verified sender identity (email or domain) before sending.",
      check: async () => {
        const creds = await listCredentials("email");
        return creds.includes("from_email");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Sign up at https://sendgrid.com (60-day trial, 100 emails/day).",
    },
    {
      automated: false,
      instruction:
        "Verify a sender identity: Settings → Sender Authentication → verify either a single sender email or your domain.",
    },
    {
      automated: false,
      instruction:
        "Create an API key: Settings → API Keys → Create API Key → 'Full Access' → copy the key (shown only once).",
    },
    {
      automated: true,
      instruction:
        "Save SendGrid API key and from_email to agentdial credentials.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: true,
      instruction: "Validate API key by checking SendGrid account status.",
      action: async () => {
        const apiKey = await getCredential("email", "api_key");
        if (!apiKey)
          throw new Error("SendGrid api_key not found in credentials");

        const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          throw new Error(
            `SendGrid API error: ${res.status} — API key may be invalid`,
          );
        }
      },
    },
  ],

  verify: async () => {
    const apiKey = await getCredential("email", "api_key");
    const fromEmail = await getCredential("email", "from_email");

    if (!apiKey) {
      return { ok: false, channel: "email", error: "No api_key configured" };
    }
    if (!fromEmail) {
      return { ok: false, channel: "email", error: "No from_email configured" };
    }

    try {
      const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        return {
          ok: false,
          channel: "email",
          error: `SendGrid API returned ${String(res.status)}`,
        };
      }
      const data = (await res.json()) as {
        first_name?: string;
        last_name?: string;
      };
      const name =
        [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        "unknown";
      return {
        ok: true,
        channel: "email",
        details: `SendGrid account "${name}" verified. Sending from: ${fromEmail}`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "email",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
