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
} from "./types.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
}

export class TelegramAdapter implements ChannelAdapter {
  readonly name = "telegram" as const;
  readonly displayName = CHANNEL_DISPLAY_NAMES.telegram;
  readonly free = true;
  readonly setupTime = CHANNEL_SETUP_TIMES.telegram;

  private token: string | null = null;
  private botInfo: TelegramUser | null = null;
  private polling = false;
  private pollAbort: AbortController | null = null;
  private lastUpdateId = 0;
  private messageHandler:
    | ((msg: GatewayMessage) => Promise<GatewayResponse>)
    | null = null;
  private connectedAt: number | null = null;
  private lastMessageAt: number | null = null;

  private async api<T>(
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.token) throw new Error("Telegram bot token not configured");
    const url = `${TELEGRAM_API}${this.token}/${method}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as {
      ok: boolean;
      result: T;
      description?: string;
    };
    if (!json.ok)
      throw new Error(`Telegram API error: ${json.description ?? "unknown"}`);
    return json.result;
  }

  async setup(config: ChannelConfig): Promise<void> {
    const token = config.credentials?.["bot_token"];
    if (!token)
      throw new Error(
        "Missing credential: bot_token. Get one from @BotFather on Telegram.",
      );
    this.token = token;
    this.botInfo = await this.api<TelegramUser>("getMe");
    await saveCredential("telegram", "bot_token", token);
  }

  async connect(): Promise<void> {
    if (!this.token) {
      const stored = await getCredential("telegram", "bot_token");
      if (!stored) throw new Error("Not configured. Run setup() first.");
      this.token = stored;
    }
    if (!this.botInfo) this.botInfo = await this.api<TelegramUser>("getMe");
    this.polling = true;
    this.connectedAt = Date.now();
    this.pollAbort = new AbortController();
    this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.api<TelegramUpdate[]>("getUpdates", {
          offset: this.lastUpdateId + 1,
          timeout: 30,
        });
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          if (update.message?.text && this.messageHandler) {
            this.lastMessageAt = Date.now();
            const msg: GatewayMessage = {
              id: String(update.message.message_id),
              channel: "telegram",
              from:
                update.message.from?.username ??
                String(update.message.from?.id ?? "unknown"),
              text: update.message.text,
              timestamp: update.message.date * 1000,
              metadata: {
                chatId: update.message.chat.id,
                chatType: update.message.chat.type,
              },
            };
            try {
              const response = await this.messageHandler(msg);
              await this.send(String(update.message.chat.id), response);
            } catch {
              /* handler errors don't crash polling */
            }
          }
        }
      } catch {
        if (this.polling) await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    this.pollAbort?.abort();
    this.pollAbort = null;
    this.connectedAt = null;
  }

  async send(to: string, response: GatewayResponse): Promise<void> {
    let text = response.text;
    if (response.cards?.length) {
      for (const card of response.cards) {
        text += `\n\n*${card.title}*`;
        if (card.description) text += `\n${card.description}`;
      }
    }
    const body: Record<string, unknown> = {
      chat_id: to,
      text,
      parse_mode: "Markdown",
    };
    if (response.actions?.length) {
      body["reply_markup"] = {
        inline_keyboard: response.actions.map((a) => [
          a.type === "url"
            ? { text: a.label, url: a.value }
            : { text: a.label, callback_data: a.value },
        ]),
      };
    }
    await this.api("sendMessage", body);
  }

  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    this.messageHandler = handler;
  }

  async test(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!this.token) {
        const stored = await getCredential("telegram", "bot_token");
        if (!stored) return { ok: false, error: "No bot token configured" };
        this.token = stored;
      }
      const me = await this.api<TelegramUser>("getMe");
      return { ok: true, error: undefined };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async status(): Promise<ChannelStatus> {
    const result = await this.test();
    return {
      channel: "telegram",
      connected: this.polling && result.ok,
      latencyMs: this.connectedAt ? Date.now() - this.connectedAt : null,
      lastMessage: this.lastMessageAt,
      error: result.error ?? null,
    };
  }
}
