import { createServer } from "node:http";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, updateConfig } from "../lib/config.js";
import { parseIdentity } from "../lib/identity.js";
import {
  normalizeMessage,
  routeMessage,
  formatResponse,
} from "../lib/gateway.js";
import {
  BuiltInAgent,
  loadAgentConfig,
  extractSystemPrompt,
} from "../lib/built-in-agent.js";
import { startTunnel } from "../lib/tunnel.js";
import { banner, heading, success, error, info, warn } from "../lib/ui.js";
import { DEFAULT_IDENTITY_FILE } from "../lib/constants.js";
import { GatewayMessageSchema, ChannelTypeSchema } from "../adapters/types.js";
import { getCredential, listConfiguredChannels } from "../lib/credentials.js";
import {
  validateTwilioSignature,
  validateSlackSignature,
  validateTelegramSecret,
} from "../lib/webhook-validation.js";
import type {
  ChannelType,
  GatewayMessage,
  GatewayResponse,
} from "../adapters/types.js";

/** Channels that use WebSocket connections (not HTTP webhooks). */
const WEBSOCKET_CHANNELS: ReadonlySet<ChannelType> = new Set([
  "discord",
  "slack",
]);

export async function cmdServe(opts: {
  port: string;
  agentUrl?: string;
  file?: string;
  tunnel?: boolean;
}): Promise<void> {
  banner();
  heading("Starting Gateway Server");

  const port = parseInt(opts.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    error(`Invalid port: ${opts.port}`);
    return;
  }

  const config = await loadConfig();
  const identityPath = resolve(
    opts.file ?? config.identityFile ?? DEFAULT_IDENTITY_FILE,
  );

  // Load identity for display
  if (existsSync(identityPath)) {
    try {
      const identity = await parseIdentity(identityPath);
      success(`Identity loaded: ${identity.name}`);
    } catch {
      warn("Could not parse IDENTITY.md — running without identity context.");
    }
  }

  // ── Resolve agent backend ──
  let agentUrl = opts.agentUrl ?? config.agentUrl;
  let builtInAgent: BuiltInAgent | null = null;

  if (!agentUrl) {
    // No agent URL — try built-in agent
    const agentConfig = await loadAgentConfig();
    const envKey =
      process.env["ANTHROPIC_API_KEY"] ?? process.env["OPENAI_API_KEY"];
    const envProvider = process.env["ANTHROPIC_API_KEY"]
      ? "anthropic"
      : "openai";

    if (agentConfig) {
      const systemPrompt = await extractSystemPrompt(identityPath);
      builtInAgent = new BuiltInAgent({
        ...agentConfig,
        systemPrompt,
      });
      success(
        `Built-in agent active (${agentConfig.provider}, ${agentConfig.model ?? "default"})`,
      );
    } else if (envKey) {
      const systemPrompt = await extractSystemPrompt(identityPath);
      builtInAgent = new BuiltInAgent({
        provider: envProvider as "anthropic" | "openai",
        apiKey: envKey,
        systemPrompt,
      });
      success(`Built-in agent active (${envProvider}, from env)`);
    } else {
      error(
        "No agent backend configured.\n" +
          "  Run: agentdial setup           (interactive wizard)\n" +
          "  Or:  agentdial serve --agent-url <url>\n" +
          "  Or:  export ANTHROPIC_API_KEY=sk-...",
      );
      return;
    }
  } else {
    if (opts.agentUrl) {
      await updateConfig({ agentUrl: opts.agentUrl });
    }
  }

  // ── Tunnel (optional) ──
  let tunnelUrl: string | null = null;
  if (opts.tunnel) {
    info("Starting tunnel...");
    try {
      const tunnel = await startTunnel(port);
      tunnelUrl = tunnel.url;
      success(`Tunnel active: ${tunnelUrl}`);
      // Clean up tunnel on process exit
      process.on("SIGINT", () => {
        tunnel.close();
        process.exit(0);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Tunnel failed: ${msg}`);
      warn("Continuing without tunnel. Webhooks need a public URL.");
    }
  }

  const displayUrl = tunnelUrl ?? `http://localhost:${String(port)}`;

  // ── Handler to get a response for a GatewayMessage ──
  async function getResponse(
    msg: import("../adapters/types.js").GatewayMessage,
  ): Promise<GatewayResponse> {
    if (builtInAgent) {
      return builtInAgent.handleMessage(msg);
    }
    return routeMessage(msg, agentUrl!);
  }

  // ── HTTP Server ──
  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          mode: builtInAgent ? "built-in" : "proxy",
          agentUrl: agentUrl ?? null,
          tunnel: tunnelUrl ?? null,
        }),
      );
      return;
    }

    // Webhook endpoint: POST /webhook/:channel
    const webhookMatch = req.url?.match(/^\/webhook\/(\w+)$/);

    if (webhookMatch && req.method === "POST") {
      const channelResult = ChannelTypeSchema.safeParse(webhookMatch[1]);
      if (!channelResult.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unknown channel" }));
        return;
      }

      const channel: ChannelType = channelResult.data;

      try {
        const rawBody = await readBody(req);

        // Parse body based on content-type (Twilio sends form-encoded, not JSON)
        const contentType = req.headers["content-type"] ?? "";
        const isFormEncoded = contentType.includes(
          "application/x-www-form-urlencoded",
        );

        // Detect alternate providers BEFORE Twilio signature validation.
        // VAPI sends JSON to /webhook/voice; AgentMail sends JSON to /webhook/email.
        // These don't use Twilio signatures and must be handled first.
        const isAlternateProvider =
          !isFormEncoded &&
          ((channel === "voice" && rawBody.includes('"message"')) ||
            (channel === "email" && rawBody.includes('"inbox_id"')));

        // Webhook signature validation (skip for alternate JSON providers)
        if (!isAlternateProvider) {
          const rejected = await validateWebhook(channel, req, rawBody, port);
          if (rejected) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Forbidden: invalid webhook signature",
              }),
            );
            return;
          }
        }
        const raw: Record<string, unknown> = isFormEncoded
          ? parseFormParams(rawBody)
          : (JSON.parse(rawBody) as Record<string, unknown>);

        // Voice channel — detect VAPI (JSON) vs Twilio (form-encoded TwiML)
        if (channel === "voice") {
          const isVapi =
            !isFormEncoded &&
            typeof raw["message"] === "object" &&
            raw["message"] !== null &&
            "type" in (raw["message"] as Record<string, unknown>);

          if (isVapi) {
            const vapiPayload =
              raw as unknown as import("../adapters/voice-vapi.js").VapiWebhookPayload;
            const { VapiVoiceAdapter } =
              await import("../adapters/voice-vapi.js");
            const vapiAdapter = new VapiVoiceAdapter();
            vapiAdapter.onMessage(async (m) => getResponse(m));
            const vapiResponse = await vapiAdapter.handleWebhook(vapiPayload);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(vapiResponse ?? { ok: true }));
            return;
          }

          // Twilio voice — form-encoded, expects TwiML XML
          const msg = normalizeMessage(raw, channel);
          const hasSpeech = Boolean(raw["SpeechResult"] || raw["Digits"]);

          if (!hasSpeech) {
            const webhookUrl = `${displayUrl}/webhook/voice`;
            const greeting =
              "Hello! I'm your AI agent. How can I help you today?";
            const twiml = buildVoiceTwiml(webhookUrl, greeting);
            res.writeHead(200, { "Content-Type": "text/xml" });
            res.end(twiml);
            return;
          }

          const response = await getResponse(msg);
          const webhookUrl = `${displayUrl}/webhook/voice`;
          const twiml = buildVoiceTwiml(webhookUrl, response.text);
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml);
          return;
        }

        // Email channel — detect AgentMail webhook (has "event" + "inbox_id")
        if (
          channel === "email" &&
          typeof raw["event"] === "string" &&
          typeof raw["inbox_id"] === "string"
        ) {
          const amPayload =
            raw as import("../adapters/email-agentmail.js").AgentMailWebhookPayload;
          const { AgentMailAdapter } =
            await import("../adapters/email-agentmail.js");
          const amAdapter = new AgentMailAdapter();
          amAdapter.onMessage(async (m) => getResponse(m));
          const amResponse = await amAdapter.handleWebhook(amPayload);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(amResponse ?? { ok: true }));
          return;
        }

        const msg = normalizeMessage(raw, channel);

        // Reject empty messages before hitting the API
        if (!msg.text || msg.text.trim() === "") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Message text is required" }));
          return;
        }

        const response = await getResponse(msg);
        const formatted = formatResponse(response, channel);

        // Telegram webhook responses need method + chat_id to send reply
        if (channel === "telegram") {
          const payload = {
            method: "sendMessage",
            chat_id: msg.from,
            ...formatted.payload,
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        } else if (channel === "sms" || channel === "whatsapp") {
          // Twilio expects TwiML XML responses for SMS and WhatsApp
          const escaped = response.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml);
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(formatted.payload));
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = errMsg === "Payload Too Large" ? 413 : 500;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }

    // Gateway endpoint: POST /message
    if (req.url === "/message" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const raw = JSON.parse(body) as Record<string, unknown>;

        // Accept both strict GatewayMessage and lenient { channel, text } shorthand
        const strict = GatewayMessageSchema.safeParse(raw);
        let msg: GatewayMessage;
        if (strict.success) {
          msg = strict.data;
        } else {
          // Require at minimum: text + channel
          const text =
            (raw.text as string) ??
            (raw.message as string) ??
            (raw.content as string);
          if (!text) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error:
                  'Missing required field "text". Send: { "channel": "web", "text": "Hello" }',
              }),
            );
            return;
          }
          const channelResult = ChannelTypeSchema.safeParse(
            raw.channel ?? "web",
          );
          msg = {
            id: (raw.id as string) ?? crypto.randomUUID(),
            channel: channelResult.success ? channelResult.data : "web",
            from:
              (raw.from as string) ??
              (raw.senderId as string) ??
              (raw.userId as string) ??
              "anonymous",
            text: String(text),
            timestamp: (raw.timestamp as number) ?? Date.now(),
          };
        }

        const response = await getResponse(msg);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = errMsg === "Payload Too Large" ? 413 : 400;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, () => {
    success(`Gateway running on ${displayUrl}`);
    if (builtInAgent) {
      info("Mode: Built-in agent (no external backend needed)");
    } else {
      info(`Mode: Proxy to ${agentUrl!}`);
    }
    if (tunnelUrl) {
      info(`Public URL: ${tunnelUrl}`);
    }
    info("Endpoints:");
    info("  POST /message          — Send a normalized GatewayMessage");
    info("  POST /webhook/:channel — Channel-specific webhook");
    info("  GET  /health           — Health check");

    // Auto-connect WebSocket-based adapters (Discord, Slack)
    void connectWebSocketAdapters(getResponse);

    // Auto-register webhooks for configured channels
    if (tunnelUrl) {
      void autoRegisterWebhooks(tunnelUrl);
    }
  });
}

/**
 * Connect WebSocket-based channel adapters that have saved credentials.
 * These run alongside the HTTP webhook server.
 */
async function connectWebSocketAdapters(
  getResponse: (msg: GatewayMessage) => Promise<GatewayResponse>,
): Promise<void> {
  const configured = await listConfiguredChannels();
  const wsChannels = configured.filter((ch) => WEBSOCKET_CHANNELS.has(ch));

  for (const channel of wsChannels) {
    try {
      if (channel === "discord") {
        const token = await getCredential("discord", "bot_token");
        if (!token) continue;

        const { DiscordAdapter } = await import("../adapters/discord.js");
        const adapter = new DiscordAdapter();
        adapter.onMessage(async (msg) => getResponse(msg));
        await adapter.setup({
          channel: "discord",
          enabled: true,
          credentials: { bot_token: token },
        });
        await adapter.connect();
        const status = await adapter.status();
        if (status.connected) {
          success("Discord bot connected (WebSocket)");
        }
      }

      if (channel === "slack") {
        const botToken = await getCredential("slack", "bot_token");
        const appToken = await getCredential("slack", "app_token");
        if (!botToken || !appToken) {
          warn(
            "Slack: need both bot_token (xoxb-) and app_token (xapp-) for Socket Mode",
          );
          continue;
        }

        const { SlackAdapter } = await import("../adapters/slack.js");
        const adapter = new SlackAdapter();
        adapter.onMessage(async (msg) => getResponse(msg));
        await adapter.setup({
          channel: "slack",
          enabled: true,
          credentials: { bot_token: botToken, app_token: appToken },
        });
        await adapter.connect();
        const status = await adapter.status();
        if (status.connected) {
          success("Slack bot connected (Socket Mode)");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`${channel}: ${msg}`);
    }
  }
}

const MAX_BODY_BYTES = 1_048_576; // 1 MB

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Payload Too Large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/** Twilio channels share the same auth token credential key. */
const TWILIO_CHANNELS: ReadonlySet<ChannelType> = new Set([
  "sms",
  "whatsapp",
  "voice",
]);

/**
 * Parse a URL-encoded form body into a flat Record (Twilio sends form-encoded).
 * Falls back to JSON body keys if the body is JSON.
 */
function parseFormParams(body: string): Record<string, string> {
  try {
    // Try URL-encoded first (Twilio's default format)
    const params: Record<string, string> = {};
    for (const pair of body.split("&")) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const key = decodeURIComponent(pair.slice(0, idx));
      const val = decodeURIComponent(pair.slice(idx + 1));
      params[key] = val;
    }
    if (Object.keys(params).length > 0) return params;
  } catch {
    // fall through
  }

  // Fallback: JSON body with string values
  try {
    const obj = JSON.parse(body) as Record<string, unknown>;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") params[k] = v;
    }
    return params;
  } catch {
    return {};
  }
}

/**
 * Validate incoming webhook signature. Returns true if the request should be REJECTED.
 */
async function validateWebhook(
  channel: ChannelType,
  req: import("node:http").IncomingMessage,
  rawBody: string,
  port: number,
): Promise<boolean> {
  const headers = req.headers;

  // Twilio (SMS, WhatsApp, Voice)
  if (TWILIO_CHANNELS.has(channel)) {
    const authToken = await getCredential(channel, "auth_token");
    if (!authToken) return false;

    const sig = headers["x-twilio-signature"];
    if (typeof sig !== "string") return true;

    const proto =
      (headers["x-forwarded-proto"] as string | undefined) ?? "http";
    const host =
      (headers["x-forwarded-host"] as string | undefined) ??
      headers["host"] ??
      `localhost:${String(port)}`;
    const webhookUrl = `${proto}://${host}${req.url ?? ""}`;

    const params = parseFormParams(rawBody);
    return !validateTwilioSignature(authToken, webhookUrl, params, sig);
  }

  // Slack
  if (channel === "slack") {
    const signingSecret = await getCredential("slack", "signing_secret");
    if (!signingSecret) return false;

    const sig = headers["x-slack-signature"];
    const ts = headers["x-slack-request-timestamp"];
    if (typeof sig !== "string" || typeof ts !== "string") return true;

    return !validateSlackSignature(signingSecret, ts, rawBody, sig);
  }

  // Telegram
  if (channel === "telegram") {
    const secret = await getCredential("telegram", "webhook_secret");
    if (!secret) return false;

    const headerSecret = headers["x-telegram-bot-api-secret-token"];
    if (typeof headerSecret !== "string") return true;

    return !validateTelegramSecret(secret, headerSecret);
  }

  return false;
}

/** Escape XML special characters for TwiML responses. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build TwiML that speaks a response and gathers the next speech input.
 * This creates a conversational loop — after speaking, Twilio listens
 * for more speech and POSTs back to the webhook URL.
 */
function buildVoiceTwiml(webhookUrl: string, sayText: string): string {
  const action = webhookUrl ? ` action="${escapeXml(webhookUrl)}"` : "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Gather input="speech" speechTimeout="auto"${action} method="POST">`,
    `    <Say voice="Polly.Joanna">${escapeXml(sayText)}</Say>`,
    "  </Gather>",
    '  <Say voice="Polly.Joanna">I didn\'t hear anything. Goodbye.</Say>',
    "</Response>",
  ].join("\n");
}

/**
 * Auto-register webhooks with all configured channels after tunnel starts.
 */
async function autoRegisterWebhooks(tunnelUrl: string): Promise<void> {
  const configured = await listConfiguredChannels();

  for (const channel of configured) {
    try {
      // Telegram: register webhook via Bot API
      if (channel === "telegram") {
        const token = await getCredential("telegram", "bot_token");
        if (!token) continue;
        const webhookUrl = `${tunnelUrl}/webhook/telegram`;
        const res = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
        );
        const data = (await res.json()) as {
          ok: boolean;
          description?: string;
        };
        if (data.ok) {
          success(`Telegram webhook registered: ${webhookUrl}`);
        } else {
          warn(`Telegram webhook failed: ${data.description ?? "unknown"}`);
        }
      }

      // Twilio SMS: configure webhook on phone number
      if (channel === "sms") {
        const sid = await getCredential("sms", "account_sid");
        const token = await getCredential("sms", "auth_token");
        const phone = await getCredential("sms", "phone_number");
        if (!sid || !token || !phone) continue;
        // Find the phone number SID
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const listRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone)}`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        const listData = (await listRes.json()) as {
          incoming_phone_numbers?: Array<{ sid: string }>;
        };
        const numberSid = listData.incoming_phone_numbers?.[0]?.sid;
        if (!numberSid) {
          warn("SMS: could not find phone number SID for webhook registration");
          continue;
        }
        const webhookUrl = `${tunnelUrl}/webhook/sms`;
        const updateRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${numberSid}.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `SmsUrl=${encodeURIComponent(webhookUrl)}&VoiceUrl=${encodeURIComponent(`${tunnelUrl}/webhook/voice`)}`,
          },
        );
        if (updateRes.ok) {
          success(`Twilio webhooks registered: SMS + Voice → ${tunnelUrl}`);
        } else {
          warn(`Twilio webhook update failed: ${updateRes.statusText}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`Auto-webhook (${channel}): ${msg}`);
    }
  }
}
