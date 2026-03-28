import { getCredential } from "../lib/credentials.js";
import { twilioFetch } from "../lib/twilio.js";
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";

interface TwilioMessagePayload {
  MessageSid: string;
  From: string;
  Body: string;
  NumMedia?: string;
  [key: string]: string | undefined;
}

export class TwilioSmsAdapter implements ChannelAdapter {
  readonly name = "sms" as const;
  readonly displayName = "SMS (Twilio)";
  readonly free = false;
  readonly cost = "$0.0079/msg";
  readonly setupTime = "5 min";

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
    this.accountSid =
      config.credentials?.account_sid ??
      (await getCredential("sms", "account_sid")) ??
      "";
    this.authToken =
      config.credentials?.auth_token ??
      (await getCredential("sms", "auth_token")) ??
      "";
    this.phoneNumber =
      config.credentials?.phone_number ??
      (await getCredential("sms", "phone_number")) ??
      "";
    this.webhookUrl = config.webhookUrl ?? "";

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error(
        "Twilio SMS requires account_sid, auth_token, and phone_number",
      );
    }

    // Validate credentials by fetching account info
    await twilioFetch(this.accountSid, this.authToken, ".json");
  }

  async connect(): Promise<void> {
    // Webhook-based — no persistent connection needed.
    // If webhookUrl is set, update the phone number's SMS URL.
    if (this.webhookUrl) {
      try {
        const params = new URLSearchParams({
          SmsUrl: this.webhookUrl,
          SmsMethod: "POST",
        });
        await twilioFetch(
          this.accountSid,
          this.authToken,
          `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(this.phoneNumber)}`,
        );
      } catch {
        // Non-fatal — webhook can be configured manually in Twilio console
      }
    }
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
      }
    }
    if (response.actions?.length) {
      body += "\n\nOptions:";
      for (const action of response.actions) {
        body +=
          action.type === "url"
            ? `\n- ${action.label}: ${action.value}`
            : `\n- Reply "${action.value}" for ${action.label}`;
      }
    }

    const params = new URLSearchParams({
      To: to,
      From: this.phoneNumber,
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

  /** Call this from your HTTP webhook handler with the parsed Twilio POST body. */
  async handleWebhook(payload: TwilioMessagePayload): Promise<string> {
    this.lastMessageTs = Date.now();
    const msg: GatewayMessage = {
      id: payload.MessageSid,
      channel: "sms",
      from: payload.From,
      text: payload.Body ?? "",
      timestamp: Date.now(),
      attachments: parseMediaAttachments(payload),
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
        channel: "sms",
        connected: this.connected,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: null,
      };
    } catch (err) {
      return {
        channel: "sms",
        connected: false,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

function parseMediaAttachments(
  payload: TwilioMessagePayload,
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
