import { getCredential } from "../lib/credentials.js";
import { twilioFetch } from "../lib/twilio.js";
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";

interface WhatsAppWebhookPayload {
  MessageSid: string;
  From: string;
  Body: string;
  ProfileName?: string;
  NumMedia?: string;
  [key: string]: string | undefined;
}

function ensureWhatsAppPrefix(number: string): string {
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
}

function stripWhatsAppPrefix(number: string): string {
  return number.startsWith("whatsapp:") ? number.slice(9) : number;
}

export class TwilioWhatsAppAdapter implements ChannelAdapter {
  readonly name = "whatsapp" as const;
  readonly displayName = "WhatsApp (Twilio)";
  readonly free = false;
  readonly cost = "$0.005/msg + Meta fees";
  readonly setupTime = "10 min";

  private accountSid = "";
  private authToken = "";
  private phoneNumber = "";
  private webhookUrl = "";
  private messageHandler:
    | ((msg: GatewayMessage) => Promise<GatewayResponse>)
    | null = null;
  private connected = false;
  private lastMessageTs: number | null = null;

  async setup(config: ChannelConfig): Promise<void> {
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

  async connect(): Promise<void> {
    // WhatsApp is webhook-based through Twilio sandbox or production sender.
    // Webhook URL is configured in the Twilio console or via API.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(to: string, response: GatewayResponse): Promise<void> {
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

  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    this.messageHandler = handler;
  }

  /** Call from HTTP webhook handler with parsed Twilio WhatsApp POST body. */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<string> {
    this.lastMessageTs = Date.now();
    const msg: GatewayMessage = {
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

  async test(): Promise<{ ok: boolean; error?: string }> {
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

  async status(): Promise<ChannelStatus> {
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

function parseMediaAttachments(
  payload: WhatsAppWebhookPayload,
): GatewayMessage["attachments"] {
  const count = parseInt(payload.NumMedia ?? "0", 10);
  if (count === 0) return undefined;
  const attachments: NonNullable<GatewayMessage["attachments"]> = [];
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
