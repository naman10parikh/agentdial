import { getCredential, listCredentials } from "../lib/credentials.js";
import type { Recipe } from "./types.js";

export const voiceRecipe: Recipe = {
  channel: "voice",
  name: "Voice (Twilio + STT/TTS)",
  frictionTier: 1,
  cost: {
    setup: "FREE (trial)",
    monthly: "$1.15 (number)",
    perMessage: "$0.05/min",
  },

  prerequisites: [
    {
      name: "Twilio account with voice-capable number",
      description:
        "Sign up at https://www.twilio.com/try-twilio — trial includes a voice number and $15 credit",
      check: async () => {
        const creds = await listCredentials("voice");
        return creds.includes("account_sid") && creds.includes("auth_token");
      },
    },
    {
      name: "STT/TTS provider API key",
      description:
        "Optional: ElevenLabs, OpenAI Whisper, or Deepgram for enhanced voice. Twilio built-in STT/TTS works without extra keys.",
      check: async () => {
        // Optional — always passes
        return true;
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
        "Copy your Account SID and Auth Token from the Twilio Console dashboard.",
    },
    {
      automated: false,
      instruction:
        "Get a voice-capable phone number: Twilio Console → Phone Numbers → Buy a Number → ensure 'Voice' capability is checked.",
    },
    {
      automated: true,
      instruction: "Save Twilio voice credentials to agentdial.",
      action: async () => {
        // Runner handles credential collection
      },
    },
    {
      automated: false,
      instruction:
        "(Optional) For enhanced voice, get an API key from ElevenLabs (https://elevenlabs.io), OpenAI (Whisper), or Deepgram. Save as tts_api_key credential.",
    },
    {
      automated: true,
      instruction: "Validate Twilio credentials and check voice capability.",
      action: async () => {
        const sid = await getCredential("voice", "account_sid");
        const token = await getCredential("voice", "auth_token");
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
    const sid = await getCredential("voice", "account_sid");
    const token = await getCredential("voice", "auth_token");
    const phone = await getCredential("voice", "phone_number");

    if (!sid || !token) {
      return {
        ok: false,
        channel: "voice",
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
          channel: "voice",
          error: `Twilio API returned ${String(res.status)}`,
        };
      }
      const hasTts = await getCredential("voice", "tts_api_key");
      return {
        ok: true,
        channel: "voice",
        details: `Voice active${phone ? ` (${phone})` : ""}. TTS: ${hasTts ? "enhanced (custom provider)" : "Twilio built-in"}`,
      };
    } catch (err) {
      return {
        ok: false,
        channel: "voice",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
