import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

export const twilioWhatsappRecipe: Recipe = {
  channel: "whatsapp",
  name: "WhatsApp (Twilio Sandbox)",
  frictionTier: 1,
  cost: {
    setup: "FREE (sandbox)",
    monthly: "$1.15 (prod)",
    perMessage: "$0.005/msg (sandbox free)",
  },

  prerequisites: [
    {
      name: "Twilio account",
      description:
        "Sign up at https://www.twilio.com/try-twilio — sandbox is instant, no verification needed",
      check: async () => {
        const creds = await listCredentials("whatsapp");
        return creds.includes("account_sid") && creds.includes("auth_token");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Sign up at https://www.twilio.com/try-twilio if you don't have an account.",
    },
    {
      automated: false,
      instruction:
        "Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message. Follow the sandbox join instructions (send 'join <word>' to the sandbox number).",
    },
    {
      automated: false,
      instruction:
        "Copy your Account SID and Auth Token from the Twilio Console dashboard.",
    },
    {
      automated: true,
      instruction: "Save Twilio credentials to agentdial.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: true,
      instruction: "Validate Twilio credentials and check sandbox status.",
      action: async () => {
        const sid = await getCredential("whatsapp", "account_sid");
        const token = await getCredential("whatsapp", "auth_token");
        if (!sid || !token) throw new Error("Twilio credentials not found");

        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        if (!res.ok) {
          throw new Error(
            `Twilio API error: ${res.status} — credentials may be invalid`,
          );
        }
      },
    },
  ],

  verify: async () => {
    const sid = await getCredential("whatsapp", "account_sid");
    const token = await getCredential("whatsapp", "auth_token");
    const phone = await getCredential("whatsapp", "phone_number");

    if (!sid || !token) {
      return {
        ok: false,
        channel: "whatsapp",
        error: "Missing account_sid or auth_token",
      };
    }

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (!res.ok) {
        return {
          ok: false,
          channel: "whatsapp",
          error: `Twilio API returned ${String(res.status)}`,
        };
      }
      const mode = phone ? "production" : "sandbox";
      return {
        ok: true,
        channel: "whatsapp",
        details: `WhatsApp ${mode} mode active${phone ? ` (${phone})` : ""}. Note: sandbox requires recipients to opt-in via 'join' message.`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "whatsapp",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
