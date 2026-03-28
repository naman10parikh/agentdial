import { getCredential, saveCredential } from "../lib/credentials.js";
import {
  CHANNEL_DISPLAY_NAMES,
  CHANNEL_SETUP_TIMES,
} from "../lib/constants.js";
export class DiscordAdapter {
  name = "discord";
  displayName = CHANNEL_DISPLAY_NAMES.discord;
  free = true;
  setupTime = CHANNEL_SETUP_TIMES.discord;
  client = null;
  token = null;
  messageHandler = null;
  connectedAt = null;
  lastMessageAt = null;
  async loadDiscordJs() {
    try {
      const pkg = "discord.js";
      const mod = await import(/* webpackIgnore: true */ pkg);
      return mod;
    } catch {
      throw new Error("discord.js not installed. Run: npm install discord.js");
    }
  }
  async setup(config) {
    const token = config.credentials?.["bot_token"];
    if (!token)
      throw new Error(
        "Missing credential: bot_token. Create a bot at discord.com/developers/applications.",
      );
    await this.loadDiscordJs();
    this.token = token;
    await saveCredential("discord", "bot_token", token);
  }
  async connect() {
    if (!this.token) {
      const stored = await getCredential("discord", "bot_token");
      if (!stored) throw new Error("Not configured. Run setup() first.");
      this.token = stored;
    }
    const { Client, GatewayIntentBits } = await this.loadDiscordJs();
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.client.on("messageCreate", (raw) => {
      const message = raw;
      if (message.author.bot || !this.messageHandler) return;
      this.lastMessageAt = Date.now();
      const attachments = [...message.attachments.values()].map((a) => ({
        type: "file",
        url: a.url,
        name: a.name,
        mimeType: a.contentType ?? undefined,
      }));
      const msg = {
        id: message.id,
        channel: "discord",
        from: message.author.username,
        text: message.content,
        timestamp: message.createdTimestamp,
        threadId: message.channelId,
        replyTo: message.reference?.messageId,
        attachments: attachments.length ? attachments : undefined,
        metadata: { guildId: message.guildId, channelId: message.channelId },
      };
      this.messageHandler(msg)
        .then((response) => {
          this.send(message.channelId, response).catch(() => {});
        })
        .catch(() => {});
    });
    await this.client.login(this.token);
    this.connectedAt = Date.now();
  }
  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.connectedAt = null;
  }
  async send(to, response) {
    if (!this.client) throw new Error("Not connected");
    const channel = await this.client.channels.fetch(to);
    let content = response.text;
    if (response.cards?.length) {
      for (const card of response.cards) {
        content += `\n\n**${card.title}**`;
        if (card.description) content += `\n${card.description}`;
      }
    }
    if (content.length > 2000) content = content.slice(0, 1997) + "...";
    await channel.send({ content });
  }
  onMessage(handler) {
    this.messageHandler = handler;
  }
  async test() {
    try {
      if (!this.client?.isReady())
        return { ok: false, error: "Bot not connected" };
      const tag = this.client.user?.tag ?? "unknown";
      const guilds = this.client.guilds.cache.size;
      return { ok: true, error: undefined };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  async status() {
    const connected = this.client?.isReady() ?? false;
    return {
      channel: "discord",
      connected,
      latencyMs: connected ? this.client.ws.ping : null,
      lastMessage: this.lastMessageAt,
      error: connected ? null : "Not connected",
    };
  }
}
//# sourceMappingURL=discord.js.map
