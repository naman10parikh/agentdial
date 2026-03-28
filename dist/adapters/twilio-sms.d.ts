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
export declare class TwilioSmsAdapter implements ChannelAdapter {
  readonly name: "sms";
  readonly displayName = "SMS (Twilio)";
  readonly free = false;
  readonly cost = "$0.0079/msg";
  readonly setupTime = "5 min";
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
  /** Call this from your HTTP webhook handler with the parsed Twilio POST body. */
  handleWebhook(payload: TwilioMessagePayload): Promise<string>;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
export {};
//# sourceMappingURL=twilio-sms.d.ts.map
