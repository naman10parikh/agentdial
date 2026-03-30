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
import { getCredential } from "../lib/credentials.js";
import {
  validateTwilioSignature,
  validateSlackSignature,
  validateTelegramSecret,
} from "../lib/webhook-validation.js";
import type { ChannelType, GatewayResponse } from "../adapters/types.js";

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

        // Webhook signature validation
        const rejected = await validateWebhook(channel, req, rawBody, port);
        if (rejected) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Forbidden: invalid webhook signature" }),
          );
          return;
        }

        const raw = JSON.parse(rawBody) as Record<string, unknown>;
        const msg = normalizeMessage(raw, channel);
        const response = await getResponse(msg);
        const formatted = formatResponse(response, channel);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(formatted.payload));
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
        const raw = JSON.parse(body) as unknown;
        const msg = GatewayMessageSchema.parse(raw);
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
  });
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
