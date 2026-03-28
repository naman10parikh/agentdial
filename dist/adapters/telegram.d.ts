import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";
export declare class TelegramAdapter implements ChannelAdapter {
  readonly name: "telegram";
  readonly displayName: string;
  readonly free = true;
  readonly setupTime: string;
  private token;
  private botInfo;
  private polling;
  private pollAbort;
  private lastUpdateId;
  private messageHandler;
  private connectedAt;
  private lastMessageAt;
  private api;
  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  private pollLoop;
  disconnect(): Promise<void>;
  send(to: string, response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
//# sourceMappingURL=telegram.d.ts.map
