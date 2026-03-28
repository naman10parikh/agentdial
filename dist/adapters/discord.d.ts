import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";
export declare class DiscordAdapter implements ChannelAdapter {
  readonly name: "discord";
  readonly displayName: string;
  readonly free = true;
  readonly setupTime: string;
  private client;
  private token;
  private messageHandler;
  private connectedAt;
  private lastMessageAt;
  private loadDiscordJs;
  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(to: string, response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
//# sourceMappingURL=discord.d.ts.map
