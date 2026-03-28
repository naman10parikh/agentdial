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
export declare class TwilioWhatsAppAdapter implements ChannelAdapter {
  readonly name: "whatsapp";
  readonly displayName = "WhatsApp (Twilio)";
  readonly free = false;
  readonly cost = "$0.005/msg + Meta fees";
  readonly setupTime = "10 min";
  private accountSid;
  private authToken;
  private phoneNumber;
  private webhookUrl;
  private messageHandler;
  private connected;
  private lastMessageTs;
  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(to: string, response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  /** Call from HTTP webhook handler with parsed Twilio WhatsApp POST body. */
  handleWebhook(payload: WhatsAppWebhookPayload): Promise<string>;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
export {};
//# sourceMappingURL=twilio-whatsapp.d.ts.map
