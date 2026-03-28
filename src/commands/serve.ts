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
import { banner, heading, success, error, info, warn } from "../lib/ui.js";
import { DEFAULT_IDENTITY_FILE } from "../lib/constants.js";
import { GatewayMessageSchema, ChannelTypeSchema } from "../adapters/types.js";
import { getCredential } from "../lib/credentials.js";
import {
  validateTwilioSignature,
  validateSlackSignature,
  validateTelegramSecret,
} from "../lib/webhook-validation.js";
import type { ChannelType } from "../adapters/types.js";

export async function cmdServe(opts: {
  port: string;
  agentUrl?: string;
  file?: string;
}): Promise<void> {
  banner();
  heading("Starting Gateway Server");

  const port = parseInt(opts.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    error(`Invalid port: ${opts.port}`);
    return;
  }

  const config = await loadConfig();
  const agentUrl = opts.agentUrl ?? config.agentUrl;

  if (!agentUrl) {
    error("No agent URL. Use --agent-url or set agent_url in IDENTITY.md.");
    return;
  }

  if (opts.agentUrl) {
    await updateConfig({ agentUrl: opts.agentUrl });
  }

  const identityPath = resolve(
    opts.file ?? config.identityFile ?? DEFAULT_IDENTITY_FILE,
  );

  if (existsSync(identityPath)) {
    try {
      const identity = await parseIdentity(identityPath);
      success(`Identity loaded: ${identity.name}`);
    } catch {
      warn("Could not parse IDENTITY.md — running without identity context.");
    }
  }

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
      res.end(JSON.stringify({ status: "ok", agentUrl }));
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

        // ── Webhook signature validation ──
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
        const response = await routeMessage(msg, agentUrl);
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
        const response = await routeMessage(msg, agentUrl);

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
    success(`Gateway running on http://localhost:${String(port)}`);
    info(`Agent URL: ${agentUrl}`);
    info("Endpoints:");
    info(`  POST /message         — Send a normalized GatewayMessage`);
    info(`  POST /webhook/:channel — Channel-specific webhook`);
    info(`  GET  /health          — Health check`);
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
 * Returns false (allow) if no credentials are configured for the channel
 * (graceful degradation — validation only enforced when credentials exist).
 */
async function validateWebhook(
  channel: ChannelType,
  req: import("node:http").IncomingMessage,
  rawBody: string,
  port: number,
): Promise<boolean> {
  const headers = req.headers;

  // ── Twilio (SMS, WhatsApp, Voice) ──
  if (TWILIO_CHANNELS.has(channel)) {
    const authToken = await getCredential(channel, "auth_token");
    if (!authToken) return false; // No credentials configured — skip validation

    const sig = headers["x-twilio-signature"];
    if (typeof sig !== "string") return true; // Missing signature header → reject

    // Reconstruct the webhook URL that Twilio used to compute the signature.
    // Use X-Forwarded-Proto/Host if behind a reverse proxy, otherwise localhost.
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

  // ── Slack ──
  if (channel === "slack") {
    const signingSecret = await getCredential("slack", "signing_secret");
    if (!signingSecret) return false;

    const sig = headers["x-slack-signature"];
    const ts = headers["x-slack-request-timestamp"];
    if (typeof sig !== "string" || typeof ts !== "string") return true;

    return !validateSlackSignature(signingSecret, ts, rawBody, sig);
  }

  // ── Telegram ──
  if (channel === "telegram") {
    const secret = await getCredential("telegram", "webhook_secret");
    if (!secret) return false;

    const headerSecret = headers["x-telegram-bot-api-secret-token"];
    if (typeof headerSecret !== "string") return true;

    return !validateTelegramSecret(secret, headerSecret);
  }

  // All other channels: no validation implemented yet — allow through
  return false;
}
