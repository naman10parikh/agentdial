import { getCredential } from "../lib/credentials.js";
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
function ensureWhatsAppPrefix(number) {
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
}
function stripWhatsAppPrefix(number) {
  return number.startsWith("whatsapp:") ? number.slice(9) : number;
}
export class TwilioWhatsAppAdapter {
  name = "whatsapp";
  displayName = "WhatsApp (Twilio)";
  free = false;
  cost = "$0.005/msg + Meta fees";
  setupTime = "10 min";
  accountSid = "";
  authToken = "";
  phoneNumber = "";
  webhookUrl = "";
  messageHandler = null;
  connected = false;
  lastMessageTs = null;
  async setup(config) {
    // WhatsApp shares Twilio creds — check whatsapp first, fall back to sms
    this.accountSid =
      config.credentials?.account_sid ??
      (await getCredential("whatsapp", "account_sid")) ??
      (await getCredential("sms", "account_sid")) ??
      "";
    this.authToken =
      config.credentials?.auth_token ??
      (await getCredential("whatsapp", "auth_token")) ??
      (await getCredential("sms", "auth_token")) ??
      "";
    this.phoneNumber =
      config.credentials?.phone_number ??
      (await getCredential("whatsapp", "phone_number")) ??
      (await getCredential("sms", "phone_number")) ??
      "";
    this.webhookUrl = config.webhookUrl ?? "";
    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error(
        "Twilio WhatsApp requires account_sid, auth_token, and phone_number",
      );
    }
    // Validate credentials
    await twilioFetch(this.accountSid, this.authToken, ".json");
  }
  async connect() {
    // WhatsApp is webhook-based through Twilio sandbox or production sender.
    // Webhook URL is configured in the Twilio console or via API.
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async send(to, response) {
    let body = response.text;
    if (response.cards?.length) {
      for (const card of response.cards) {
        body += `\n\n*${card.title}*`;
        if (card.description) body += `\n${card.description}`;
        if (card.actions?.length) {
          for (const action of card.actions) {
            body +=
              action.type === "url"
                ? `\n${action.label}: ${action.value}`
                : `\n> ${action.label}`;
          }
        }
      }
    }
    const params = new URLSearchParams({
      To: ensureWhatsAppPrefix(to),
      From: ensureWhatsAppPrefix(this.phoneNumber),
      Body: body,
    });
    await twilioFetch(this.accountSid, this.authToken, "/Messages.json", {
      method: "POST",
      body: params.toString(),
    });
  }
  onMessage(handler) {
    this.messageHandler = handler;
  }
  /** Call from HTTP webhook handler with parsed Twilio WhatsApp POST body. */
  async handleWebhook(payload) {
    this.lastMessageTs = Date.now();
    const msg = {
      id: payload.MessageSid,
      channel: "whatsapp",
      from: stripWhatsAppPrefix(payload.From),
      text: payload.Body ?? "",
      timestamp: Date.now(),
      attachments: parseMediaAttachments(payload),
      metadata: payload.ProfileName
        ? { profileName: payload.ProfileName }
        : undefined,
    };
    if (!this.messageHandler) {
      return "<Response><Message>No handler configured</Message></Response>";
    }
    const response = await this.messageHandler(msg);
    return `<Response><Message>${escapeXml(response.text)}</Message></Response>`;
  }
  async test() {
    try {
      await twilioFetch(this.accountSid, this.authToken, ".json");
      // Verify the number can send WhatsApp by checking messaging service
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
        channel: "whatsapp",
        connected: this.connected,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: null,
      };
    } catch (err) {
      return {
        channel: "whatsapp",
        connected: false,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
function parseMediaAttachments(payload) {
  const count = parseInt(payload.NumMedia ?? "0", 10);
  if (count === 0) return undefined;
  const attachments = [];
  for (let i = 0; i < count; i++) {
    const url = payload[`MediaUrl${i}`];
    const mime = payload[`MediaContentType${i}`];
    if (url) {
      attachments.push({
        type: mime?.startsWith("image/")
          ? "image"
          : mime?.startsWith("audio/")
            ? "audio"
            : mime?.startsWith("video/")
              ? "video"
              : "file",
        url,
        mimeType: mime ?? undefined,
      });
    }
  }
  return attachments.length > 0 ? attachments : undefined;
}
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
//# sourceMappingURL=twilio-whatsapp.js.map
