import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";
interface InboundParsePayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: string;
  "attachment-info"?: string;
  [key: string]: string | undefined;
}
export declare class EmailAdapter implements ChannelAdapter {
  readonly name: "email";
  readonly displayName = "Email (SendGrid)";
  readonly free = false;
  readonly cost = "100/day free, then $0.001/msg";
  readonly setupTime = "3 min";
  private apiKey;
  private fromEmail;
  private fromName;
  private messageHandler;
  private connected;
  private lastMessageTs;
  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(to: string, response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  /** Call from HTTP webhook handler with parsed SendGrid Inbound Parse POST body. */
  handleWebhook(payload: InboundParsePayload): Promise<GatewayResponse | null>;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
export {};
//# sourceMappingURL=email.d.ts.map
