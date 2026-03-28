import { getCredential } from "../lib/credentials.js";
export const VOICE_PROVIDERS = [
  {
    id: "openai-realtime",
    name: "OpenAI Realtime API",
    cost: "$0.06-0.24/min",
    description: "Full duplex, GPT-4o voice",
    credentialKeys: ["openai_api_key"],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    cost: "$0.01-0.05/min",
    description: "Best voices, ultra-low latency, voice cloning",
    credentialKeys: ["elevenlabs_api_key"],
  },
  {
    id: "deepgram",
    name: "Deepgram",
    cost: "$0.006/min",
    description: "Cheapest STT, fast transcription",
    credentialKeys: ["deepgram_api_key"],
  },
  {
    id: "vapi",
    name: "Vapi.ai",
    cost: "$0.05/min",
    description: "Managed solution, all-inclusive",
    credentialKeys: ["vapi_api_key"],
  },
  {
    id: "livekit",
    name: "LiveKit Agents",
    cost: "free (self-hosted)",
    description: "Open source, WebRTC",
    credentialKeys: ["livekit_url", "livekit_api_key", "livekit_api_secret"],
  },
  {
    id: "custom",
    name: "Custom",
    cost: "varies",
    description: "Bring your own STT/TTS pipeline",
    credentialKeys: ["custom_endpoint"],
  },
];
function basicAuth(sid, token) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}
async function twilioFetch(sid, token, path, options = {}) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: basicAuth(sid, token),
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio API ${res.status}: ${text}`);
  }
  return res.json();
}
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
// ── Voice Adapter ──
export class VoiceAdapter {
  name = "voice";
  displayName = "Voice (Twilio)";
  free = false;
  cost = "$0.014/min + provider";
  setupTime = "5 min";
  accountSid = "";
  authToken = "";
  phoneNumber = "";
  webhookUrl = "";
  voiceProvider = "openai-realtime";
  messageHandler = null;
  connected = false;
  lastMessageTs = null;
  async setup(config) {
    // Voice shares Twilio creds — check voice first, fall back to sms
    this.accountSid =
      config.credentials?.account_sid ??
      (await getCredential("voice", "account_sid")) ??
      (await getCredential("sms", "account_sid")) ??
      "";
    this.authToken =
      config.credentials?.auth_token ??
      (await getCredential("voice", "auth_token")) ??
      (await getCredential("sms", "auth_token")) ??
      "";
    this.phoneNumber =
      config.credentials?.phone_number ??
      (await getCredential("voice", "phone_number")) ??
      (await getCredential("sms", "phone_number")) ??
      "";
    this.webhookUrl = config.webhookUrl ?? "";
    // Load voice provider preference
    const provider = await getCredential("voice", "voice_provider");
    if (provider && isValidProvider(provider)) {
      this.voiceProvider = provider;
    }
    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error(
        "Voice requires Twilio accountSid, authToken, and phoneNumber. " +
          "Run `agentdial voice setup` or configure SMS first.",
      );
    }
    // Validate Twilio credentials
    await twilioFetch(this.accountSid, this.authToken, ".json");
  }
  async connect() {
    // Register the voice webhook URL on the Twilio phone number
    if (this.webhookUrl) {
      try {
        const listRes = await twilioFetch(
          this.accountSid,
          this.authToken,
          `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(this.phoneNumber)}`,
        );
        // In production, update the VoiceUrl on the phone number resource
        void listRes;
      } catch {
        // Non-fatal — webhook can be configured manually in Twilio console
      }
    }
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async send(_to, _response) {
    // Voice is synchronous (call-based). Outbound calls use a different flow.
    // For outbound TTS, initiate a call via Twilio REST API:
    // POST /Calls.json with Url pointing to TwiML that plays the message.
    // Left as a no-op here; the real response path is handleWebhook -> TwiML.
  }
  onMessage(handler) {
    this.messageHandler = handler;
  }
  /**
   * Handle incoming Twilio voice webhook.
   * Returns TwiML that gathers speech, sends it to the agent, and speaks the response.
   */
  async handleWebhook(payload) {
    this.lastMessageTs = Date.now();
    // Initial call — no speech yet, greet and gather
    if (!payload.SpeechResult) {
      return buildGatherTwiml(
        this.webhookUrl,
        "Hello! How can I help you today?",
      );
    }
    // Speech recognized — route through the agent
    const msg = {
      id: payload.CallSid,
      channel: "voice",
      from: payload.From,
      text: payload.SpeechResult,
      timestamp: Date.now(),
      metadata: {
        callSid: payload.CallSid,
        confidence: payload.Confidence,
        direction: payload.Direction,
        voiceProvider: this.voiceProvider,
      },
    };
    if (!this.messageHandler) {
      return buildSayTwiml("No agent is connected. Please try again later.");
    }
    const response = await this.messageHandler(msg);
    // Speak the agent response, then gather more speech
    return buildGatherTwiml(this.webhookUrl, response.text);
  }
  async test() {
    try {
      await twilioFetch(this.accountSid, this.authToken, ".json");
      // Verify voice provider credentials exist
      const providerMeta = VOICE_PROVIDERS.find(
        (p) => p.id === this.voiceProvider,
      );
      if (providerMeta) {
        for (const key of providerMeta.credentialKeys) {
          const val = await getCredential("voice", key);
          if (!val) {
            return {
              ok: false,
              error: `Missing voice provider credential: ${key}`,
            };
          }
        }
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  async status() {
    const start = Date.now();
    try {
      await twilioFetch(this.accountSid, this.authToken, ".json");
      return {
        channel: "voice",
        connected: this.connected,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: null,
      };
    } catch (err) {
      return {
        channel: "voice",
        connected: false,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  /** Current voice provider selection */
  getProvider() {
    return this.voiceProvider;
  }
}
// ── TwiML Builders ──
function buildGatherTwiml(webhookUrl, sayText) {
  const action = webhookUrl ? ` action="${escapeXml(webhookUrl)}"` : "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Gather input="speech" speechTimeout="auto"${action} method="POST">`,
    `    <Say voice="Polly.Joanna">${escapeXml(sayText)}</Say>`,
    "  </Gather>",
    '  <Say voice="Polly.Joanna">I didn\'t hear anything. Goodbye.</Say>',
    "</Response>",
  ].join("\n");
}
function buildSayTwiml(text) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Say voice="Polly.Joanna">${escapeXml(text)}</Say>`,
    "</Response>",
  ].join("\n");
}
// ── Helpers ──
function isValidProvider(value) {
  return VOICE_PROVIDERS.some((p) => p.id === value);
}
//# sourceMappingURL=voice.js.map
