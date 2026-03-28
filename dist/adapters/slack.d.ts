import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";
export declare class SlackAdapter implements ChannelAdapter {
  readonly name: "slack";
  readonly displayName: string;
  readonly free = false;
  readonly cost = "Free (Slack workspace required)";
  readonly setupTime: string;
  private socketClient;
  private webClient;
  private botToken;
  private appToken;
  private messageHandler;
  private connectedAt;
  private lastMessageAt;
  private loadSdk;
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
//# sourceMappingURL=slack.d.ts.map
