import { getCredential, saveCredential } from "../lib/credentials.js";
import {
  CHANNEL_DISPLAY_NAMES,
  CHANNEL_SETUP_TIMES,
} from "../lib/constants.js";
const TELEGRAM_API = "https://api.telegram.org/bot";
export class TelegramAdapter {
  name = "telegram";
  displayName = CHANNEL_DISPLAY_NAMES.telegram;
  free = true;
  setupTime = CHANNEL_SETUP_TIMES.telegram;
  token = null;
  botInfo = null;
  polling = false;
  pollAbort = null;
  lastUpdateId = 0;
  messageHandler = null;
  connectedAt = null;
  lastMessageAt = null;
  async api(method, body) {
    if (!this.token) throw new Error("Telegram bot token not configured");
    const url = `${TELEGRAM_API}${this.token}/${method}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!json.ok)
      throw new Error(`Telegram API error: ${json.description ?? "unknown"}`);
    return json.result;
  }
  async setup(config) {
    const token = config.credentials?.["bot_token"];
    if (!token)
      throw new Error(
        "Missing credential: bot_token. Get one from @BotFather on Telegram.",
      );
    this.token = token;
    this.botInfo = await this.api("getMe");
    await saveCredential("telegram", "bot_token", token);
  }
  async connect() {
    if (!this.token) {
      const stored = await getCredential("telegram", "bot_token");
      if (!stored) throw new Error("Not configured. Run setup() first.");
      this.token = stored;
    }
    if (!this.botInfo) this.botInfo = await this.api("getMe");
    this.polling = true;
    this.connectedAt = Date.now();
    this.pollAbort = new AbortController();
    this.pollLoop();
  }
  async pollLoop() {
    while (this.polling) {
      try {
        const updates = await this.api("getUpdates", {
          offset: this.lastUpdateId + 1,
          timeout: 30,
        });
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          if (update.message?.text && this.messageHandler) {
            this.lastMessageAt = Date.now();
            const msg = {
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
  async disconnect() {
    this.polling = false;
    this.pollAbort?.abort();
    this.pollAbort = null;
    this.connectedAt = null;
  }
  async send(to, response) {
    let text = response.text;
    if (response.cards?.length) {
      for (const card of response.cards) {
        text += `\n\n*${card.title}*`;
        if (card.description) text += `\n${card.description}`;
      }
    }
    const body = {
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
  onMessage(handler) {
    this.messageHandler = handler;
  }
  async test() {
    try {
      if (!this.token) {
        const stored = await getCredential("telegram", "bot_token");
        if (!stored) return { ok: false, error: "No bot token configured" };
        this.token = stored;
      }
      const me = await this.api("getMe");
      return { ok: true, error: undefined };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  async status() {
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
//# sourceMappingURL=telegram.js.map
