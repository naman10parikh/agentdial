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
export async function cmdServe(opts) {
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
      const channel = channelResult.data;
      try {
        const body = await readBody(req);
        const raw = JSON.parse(body);
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
        const raw = JSON.parse(body);
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
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
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
//# sourceMappingURL=serve.js.map
