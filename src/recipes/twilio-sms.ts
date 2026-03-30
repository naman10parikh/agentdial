import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

export const twilioSmsRecipe: Recipe = {
  channel: "sms",
  name: "SMS (Twilio)",
  frictionTier: 3,
  cost: { setup: "FREE (trial)", monthly: "$1.15", perMessage: "$0.0079/msg" },

  prerequisites: [
    {
      name: "Twilio account",
      description:
        "Sign up at https://www.twilio.com/try-twilio — free trial includes $15 credit",
      check: async () => {
        const creds = await listCredentials("sms");
        return creds.includes("account_sid") && creds.includes("auth_token");
      },
    },
  ],

  steps: [
    {
      automated: false,
      instruction:
        "Sign up at https://www.twilio.com/try-twilio (free trial gives $15 credit).",
    },
    {
      automated: false,
      instruction:
        "From the Twilio Console dashboard, copy your Account SID and Auth Token.",
    },
    {
      automated: true,
      instruction:
        "Save Twilio Account SID and Auth Token to agentdial credentials.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: true,
      instruction:
        "Buy a phone number via Twilio API (or use existing trial number).",
      action: async () => {
        const sid = await getCredential("sms", "account_sid");
        const token = await getCredential("sms", "auth_token");
        if (!sid || !token) throw new Error("Twilio credentials not found");

        // Check if phone number already exists
        const existing = await getCredential("sms", "phone_number");
        if (existing) return; // Already have a number

        // List available numbers in US
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        const data = (await res.json()) as {
          incoming_phone_numbers?: Array<{ phone_number: string }>;
        };
        const numbers = data.incoming_phone_numbers ?? [];
        if (numbers.length > 0 && numbers[0]) {
          // Use first existing number — save it
          const { saveCredential } = await import("../lib/credentials.js");
          await saveCredential("sms", "phone_number", numbers[0].phone_number);
        }
        // If no numbers, user needs to buy one manually or we'd need to call the buy API
      },
    },
    {
      automated: true,
      instruction:
        "Configure webhook URL for incoming SMS on the Twilio number.",
      action: async () => {
        // Webhook is configured when serve --tunnel starts.
        // This step validates credentials work.
        const sid = await getCredential("sms", "account_sid");
        const token = await getCredential("sms", "auth_token");
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
    const sid = await getCredential("sms", "account_sid");
    const token = await getCredential("sms", "auth_token");
    const phone = await getCredential("sms", "phone_number");

    if (!sid || !token) {
      return {
        ok: false,
        channel: "sms",
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
          channel: "sms",
          error: `Twilio API returned ${String(res.status)}`,
        };
      }
      const data = (await res.json()) as {
        friendly_name?: string;
        status?: string;
      };
      return {
        ok: true,
        channel: "sms",
        details: `Account "${data.friendly_name ?? sid}" (${data.status ?? "active"})${phone ? `, number: ${phone}` : ", no number configured"}`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "sms",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
