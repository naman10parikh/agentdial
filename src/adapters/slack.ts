import { getCredential, saveCredential } from "../lib/credentials.js";
import {
  CHANNEL_DISPLAY_NAMES,
  CHANNEL_SETUP_TIMES,
} from "../lib/constants.js";
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
  RichCard,
  Action,
} from "./types.js";

type SMClient = {
  start(): Promise<void>;
  disconnect(): Promise<void>;
  on(e: string, h: (...a: unknown[]) => void): void;
  connected: boolean;
};
type WClient = {
  auth: {
    test(): Promise<{
      ok: boolean;
      user_id?: string;
      team?: string;
      team_id?: string;
    }>;
  };
  chat: {
    postMessage(o: {
      channel: string;
      text: string;
      blocks?: unknown[];
    }): Promise<{ ok: boolean }>;
  };
};
type SlackEvent = {
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    files?: Array<{ url_private: string; name: string; mimetype?: string }>;
  };
  ack?: (r: unknown) => Promise<void>;
};

function buildBlocks(
  cards?: RichCard[],
  actions?: Action[],
): unknown[] | undefined {
  const blocks: unknown[] = [];
  if (cards?.length) {
    for (const c of cards) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: c.title },
      });
      if (c.description)
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: c.description },
        });
      if (c.imageUrl)
        blocks.push({
          type: "image",
          image_url: c.imageUrl,
          alt_text: c.title,
        });
    }
  }
  if (actions?.length) {
    blocks.push({
      type: "actions",
      elements: actions.map((a) => ({
        type: "button",
        text: { type: "plain_text", text: a.label },
        ...(a.type === "url" ? { url: a.value } : { value: a.value }),
      })),
    });
  }
  return blocks.length ? blocks : undefined;
}

export class SlackAdapter implements ChannelAdapter {
  readonly name = "slack" as const;
  readonly displayName = CHANNEL_DISPLAY_NAMES.slack;
  readonly free = false;
  readonly cost = "Free (Slack workspace required)";
  readonly setupTime = CHANNEL_SETUP_TIMES.slack;

  private socketClient: SMClient | null = null;
  private webClient: WClient | null = null;
  private botToken: string | null = null;
  private appToken: string | null = null;
  private messageHandler:
    | ((msg: GatewayMessage) => Promise<GatewayResponse>)
    | null = null;
  private connectedAt: number | null = null;
  private lastMessageAt: number | null = null;

  private async loadSdk(): Promise<{
    SM: new (o: { appToken: string }) => SMClient;
    WC: new (t: string) => WClient;
  }> {
    try {
      const sp = "@slack/socket-mode";
      const wp = "@slack/web-api";
      const [s, w] = await Promise.all([
        import(/* webpackIgnore: true */ sp) as Promise<{
          SocketModeClient: new (o: { appToken: string }) => SMClient;
        }>,
        import(/* webpackIgnore: true */ wp) as Promise<{
          WebClient: new (t: string) => WClient;
        }>,
      ]);
      return { SM: s.SocketModeClient, WC: w.WebClient };
    } catch {
      throw new Error(
        "Slack SDK not installed. Run: npm install @slack/socket-mode @slack/web-api",
      );
    }
  }

  async setup(config: ChannelConfig): Promise<void> {
    const botToken = config.credentials?.["bot_token"];
    const appToken = config.credentials?.["app_token"];
    if (!botToken)
      throw new Error(
        "Missing credential: bot_token (xoxb-...). Create a Slack app at api.slack.com/apps.",
      );
    if (!appToken)
      throw new Error(
        "Missing credential: app_token (xapp-...). Enable Socket Mode in your Slack app.",
      );
    await this.loadSdk();
    this.botToken = botToken;
    this.appToken = appToken;
    await saveCredential("slack", "bot_token", botToken);
    await saveCredential("slack", "app_token", appToken);
  }

  async connect(): Promise<void> {
    if (!this.botToken || !this.appToken) {
      this.botToken = (await getCredential("slack", "bot_token")) ?? null;
      this.appToken = (await getCredential("slack", "app_token")) ?? null;
      if (!this.botToken || !this.appToken)
        throw new Error("Not configured. Run setup() first.");
    }
    const { SM, WC } = await this.loadSdk();
    this.webClient = new WC(this.botToken);
    this.socketClient = new SM({ appToken: this.appToken });
    await this.webClient.auth.test();

    this.socketClient.on("message", (raw: unknown) => {
      const { event: evt, ack } = raw as SlackEvent;
      ack?.({}).catch(() => {});
      if (
        !evt ||
        evt.type !== "message" ||
        evt.bot_id ||
        !evt.text ||
        !this.messageHandler
      )
        return;
      this.lastMessageAt = Date.now();
      const attachments = evt.files?.map((f) => ({
        type: "file" as const,
        url: f.url_private,
        name: f.name,
        mimeType: f.mimetype,
      }));
      const msg: GatewayMessage = {
        id: evt.ts ?? String(Date.now()),
        channel: "slack",
        from: evt.user ?? "unknown",
        text: evt.text,
        timestamp: evt.ts ? parseFloat(evt.ts) * 1000 : Date.now(),
        threadId: evt.thread_ts,
        attachments: attachments?.length ? attachments : undefined,
        metadata: { channelId: evt.channel },
      };
      this.messageHandler(msg)
        .then((res) => {
          if (evt.channel) this.send(evt.channel, res).catch(() => {});
        })
        .catch(() => {});
    });

    await this.socketClient.start();
    this.connectedAt = Date.now();
  }

  async disconnect(): Promise<void> {
    if (this.socketClient) {
      await this.socketClient.disconnect();
      this.socketClient = null;
    }
    this.webClient = null;
    this.connectedAt = null;
  }

  async send(to: string, response: GatewayResponse): Promise<void> {
    if (!this.webClient) throw new Error("Not connected");
    await this.webClient.chat.postMessage({
      channel: to,
      text: response.text,
      blocks: buildBlocks(response.cards, response.actions),
    });
  }

  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    this.messageHandler = handler;
  }

  async test(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!this.webClient) {
        const botToken = await getCredential("slack", "bot_token");
        if (!botToken) return { ok: false, error: "No bot token configured" };
        const { WC } = await this.loadSdk();
        const res = await new WC(botToken).auth.test();
        return { ok: res.ok, error: res.ok ? undefined : "Auth test failed" };
      }
      const res = await this.webClient.auth.test();
      return { ok: res.ok, error: res.ok ? undefined : "Auth test failed" };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async status(): Promise<ChannelStatus> {
    return {
      channel: "slack",
      connected: this.socketClient?.connected ?? false,
      latencyMs: this.connectedAt ? Date.now() - this.connectedAt : null,
      lastMessage: this.lastMessageAt,
      error: this.socketClient?.connected ? null : "Not connected",
    };
  }
}
