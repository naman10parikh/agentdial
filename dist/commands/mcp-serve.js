#!/usr/bin/env node
/**
 * AgentDial MCP Server
 *
 * Exposes agentdial operations as MCP tools so Claude Code sessions
 * can manage agent identity, channels, and the gateway programmatically.
 *
 * Usage:
 *   claude mcp add agentdial -- npx agentdial mcp-serve
 *   OR
 *   node dist/commands/mcp-serve.js
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, updateConfig } from "../lib/config.js";
import { parseIdentity, writeIdentity } from "../lib/identity.js";
import {
  saveCredential,
  listCredentials,
  listConfiguredChannels,
} from "../lib/credentials.js";
import { ChannelTypeSchema } from "../adapters/types.js";
import {
  VERSION,
  DEFAULT_IDENTITY_FILE,
  SUPPORTED_CHANNELS,
  FREE_CHANNELS,
  CHANNEL_DISPLAY_NAMES,
  CHANNEL_SETUP_TIMES,
} from "../lib/constants.js";
// ── Tool Definitions ──
const TOOLS = [
  {
    name: "identity_status",
    description:
      "Get the agent's current identity from IDENTITY.md — name, tagline, version, enabled channels, and gateway config.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "identity_setup",
    description:
      "Create or update the agent's IDENTITY.md file with name, tagline, and optional agent URL.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
        tagline: { type: "string", description: "Agent tagline / description" },
        agent_url: {
          type: "string",
          description: "Backend URL the gateway forwards messages to",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "channel_add",
    description:
      "Add and enable a communication channel. Optionally provide credentials as key-value pairs.",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: `Channel name: ${SUPPORTED_CHANNELS.join(", ")}`,
        },
        credentials: {
          type: "object",
          description:
            "Credential key-value pairs (e.g. {bot_token: '...'}). Keys depend on channel.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "channel_remove",
    description: "Disable a previously configured channel.",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: "Channel to remove / disable",
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "channel_test",
    description:
      "Test a specific channel's credentials, or test all configured channels if no channel specified.",
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: "Channel to test (omit to test all)",
        },
      },
    },
  },
  {
    name: "channel_list",
    description:
      "List all supported channels with their configuration status, cost, and setup time.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "gateway_start",
    description:
      "Start the agentdial gateway HTTP server on a given port. Requires an agent_url to forward messages to.",
    inputSchema: {
      type: "object",
      properties: {
        port: {
          type: "number",
          description: "Port to listen on (default: 3141)",
          default: 3141,
        },
        agent_url: {
          type: "string",
          description: "Agent backend URL to forward messages to",
        },
      },
    },
  },
  {
    name: "gateway_stop",
    description: "Stop the running gateway server.",
    inputSchema: { type: "object", properties: {} },
  },
];
// ── Gateway State ──
let gatewayServer = null;
let gatewayPort = null;
// ── Tool Handlers ──
async function handleToolCall(name, args) {
  try {
    switch (name) {
      case "identity_status":
        return await handleIdentityStatus();
      case "identity_setup":
        return await handleIdentitySetup(args);
      case "channel_add":
        return await handleChannelAdd(args);
      case "channel_remove":
        return await handleChannelRemove(args);
      case "channel_test":
        return await handleChannelTest(args);
      case "channel_list":
        return await handleChannelList();
      case "gateway_start":
        return await handleGatewayStart(args);
      case "gateway_stop":
        return handleGatewayStop();
      default:
        return text(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return text(`ERROR: ${msg}`);
  }
}
function text(content) {
  return { content: [{ type: "text", text: content }] };
}
function validateChannel(raw) {
  const result = ChannelTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Unknown channel: ${String(raw)}. Supported: ${SUPPORTED_CHANNELS.join(", ")}`,
    );
  }
  return result.data;
}
// ── identity_status ──
async function handleIdentityStatus() {
  const config = await loadConfig();
  const identityPath = resolve(config.identityFile);
  const configured = await listConfiguredChannels();
  const output = {
    identity_file: identityPath,
    identity_exists: existsSync(identityPath),
    configured_channels: configured,
    gateway: {
      port: config.gatewayPort,
      agent_url: config.agentUrl ?? null,
      running: gatewayServer !== null,
      running_port: gatewayPort,
    },
  };
  if (existsSync(identityPath)) {
    try {
      const identity = await parseIdentity(identityPath);
      output.name = identity.name;
      output.tagline = identity.tagline ?? null;
      output.version = identity.version;
      output.agent_url = identity.agent_url ?? config.agentUrl ?? null;
      const channels = identity.channels ?? {};
      output.identity_channels = Object.entries(channels).map(([ch, cfg]) => ({
        channel: ch,
        enabled: cfg.enabled,
        handle: cfg.handle ?? null,
      }));
    } catch (err) {
      output.identity_error =
        err instanceof Error ? err.message : "Parse error";
    }
  }
  return text(JSON.stringify(output, null, 2));
}
// ── identity_setup ──
async function handleIdentitySetup(args) {
  const name = args["name"];
  if (!name) throw new Error("name is required");
  const tagline = args["tagline"] ?? undefined;
  const agentUrl = args["agent_url"] ?? undefined;
  const config = await loadConfig();
  const identityPath = resolve(config.identityFile ?? DEFAULT_IDENTITY_FILE);
  await writeIdentity(identityPath, {
    name,
    tagline,
    version: "1.0.0",
    agent_url: agentUrl,
  });
  if (agentUrl) {
    await updateConfig({ agentUrl });
  }
  return text(
    `Identity created: ${name}${tagline ? ` — "${tagline}"` : ""}\nFile: ${identityPath}`,
  );
}
// ── channel_add ──
async function handleChannelAdd(args) {
  const channel = validateChannel(args["channel"]);
  const creds = args["credentials"] ?? {};
  // Save credentials
  for (const [key, value] of Object.entries(creds)) {
    await saveCredential(channel, key, value);
  }
  // Enable channel in config
  const config = await loadConfig();
  const channels = config.channels ?? {};
  channels[channel] = { channel, enabled: true };
  await updateConfig({ channels });
  const credCount = Object.keys(creds).length;
  const isFree = FREE_CHANNELS.has(channel);
  return text(
    [
      `Channel added: ${CHANNEL_DISPLAY_NAMES[channel] ?? channel}`,
      `Status: enabled`,
      `Cost: ${isFree ? "free" : "paid API required"}`,
      `Setup time: ${CHANNEL_SETUP_TIMES[channel] ?? "unknown"}`,
      credCount > 0
        ? `Credentials saved: ${credCount} key(s)`
        : "No credentials provided — add them before connecting.",
    ].join("\n"),
  );
}
// ── channel_remove ──
async function handleChannelRemove(args) {
  const channel = validateChannel(args["channel"]);
  const config = await loadConfig();
  const channels = config.channels ?? {};
  if (!channels[channel]) {
    return text(`Channel ${channel} is not configured.`);
  }
  channels[channel] = { ...channels[channel], channel, enabled: false };
  await updateConfig({ channels });
  return text(`Channel ${channel} disabled.`);
}
// ── channel_test ──
async function handleChannelTest(args) {
  const rawChannel = args["channel"];
  if (rawChannel) {
    const channel = validateChannel(rawChannel);
    const creds = await listCredentials(channel);
    return text(
      [
        `Channel: ${CHANNEL_DISPLAY_NAMES[channel] ?? channel}`,
        `Credentials: ${creds.length > 0 ? creds.join(", ") : "none"}`,
        `Status: ${creds.length > 0 ? "credentials present" : "missing credentials"}`,
      ].join("\n"),
    );
  }
  // Test all
  const configured = await listConfiguredChannels();
  if (configured.length === 0) {
    return text("No channels configured. Use channel_add first.");
  }
  const lines = [];
  for (const ch of configured) {
    const creds = await listCredentials(ch);
    const status = creds.length > 0 ? `OK (${creds.length} keys)` : "MISSING";
    lines.push(`${CHANNEL_DISPLAY_NAMES[ch] ?? ch}: ${status}`);
  }
  return text(lines.join("\n"));
}
// ── channel_list ──
async function handleChannelList() {
  const configured = await listConfiguredChannels();
  const config = await loadConfig();
  const channelConfigs = config.channels ?? {};
  const rows = SUPPORTED_CHANNELS.map((ch) => {
    const isConfigured = configured.includes(ch);
    const isEnabled = channelConfigs[ch]?.enabled ?? false;
    const isFree = FREE_CHANNELS.has(ch);
    const status = isEnabled
      ? "enabled"
      : isConfigured
        ? "disabled"
        : "not configured";
    return {
      channel: ch,
      display_name: CHANNEL_DISPLAY_NAMES[ch] ?? ch,
      status,
      cost: isFree ? "free" : "paid",
      setup_time: CHANNEL_SETUP_TIMES[ch] ?? "unknown",
    };
  });
  return text(JSON.stringify(rows, null, 2));
}
// ── gateway_start ──
async function handleGatewayStart(args) {
  if (gatewayServer) {
    return text(`Gateway already running on port ${String(gatewayPort)}`);
  }
  const port = args["port"] ?? 3141;
  const agentUrl = args["agent_url"];
  if (agentUrl) {
    await updateConfig({ agentUrl });
  }
  const config = await loadConfig();
  const finalAgentUrl = agentUrl ?? config.agentUrl;
  if (!finalAgentUrl) {
    return text(
      "ERROR: No agent_url configured. Provide agent_url param or set it via identity_setup.",
    );
  }
  const { createServer } = await import("node:http");
  const { normalizeMessage, routeMessage, formatResponse } =
    await import("../lib/gateway.js");
  const { GatewayMessageSchema, ChannelTypeSchema: CTS } =
    await import("../adapters/types.js");
  return new Promise((resolvePromise) => {
    const server = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "ok", agentUrl: finalAgentUrl, port }),
        );
        return;
      }
      const webhookMatch = req.url?.match(/^\/webhook\/(\w+)$/);
      if (webhookMatch && req.method === "POST") {
        const chResult = CTS.safeParse(webhookMatch[1]);
        if (!chResult.success) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unknown channel" }));
          return;
        }
        try {
          const body = await readBody(req);
          const raw = JSON.parse(body);
          const msg = normalizeMessage(raw, chResult.data);
          const response = await routeMessage(msg, finalAgentUrl);
          const formatted = formatResponse(response, chResult.data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(formatted.payload));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
        return;
      }
      if (req.url === "/message" && req.method === "POST") {
        try {
          const body = await readBody(req);
          const msg = GatewayMessageSchema.parse(JSON.parse(body));
          const response = await routeMessage(msg, finalAgentUrl);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });
    server.listen(port, () => {
      gatewayServer = server;
      gatewayPort = port;
      resolvePromise(
        text(
          `Gateway started on http://localhost:${String(port)}\nAgent URL: ${finalAgentUrl}\nEndpoints: POST /message, POST /webhook/:channel, GET /health`,
        ),
      );
    });
    server.on("error", (err) => {
      resolvePromise(text(`ERROR starting gateway: ${err.message}`));
    });
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
// ── gateway_stop ──
function handleGatewayStop() {
  if (!gatewayServer) {
    return text("Gateway is not running.");
  }
  gatewayServer.close();
  const port = gatewayPort;
  gatewayServer = null;
  gatewayPort = null;
  return text(`Gateway stopped (was on port ${String(port)}).`);
}
// ── MCP stdio Transport ──
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const request = JSON.parse(trimmed);
      void handleRequest(request).then((response) => {
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      });
    } catch {
      // Skip malformed messages
    }
  }
});
async function handleRequest(request) {
  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "agentdial", version: VERSION },
        },
      };
    case "notifications/initialized":
      return null;
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: TOOLS },
      };
    case "tools/call": {
      const params = request.params;
      const toolResult = await handleToolCall(
        params.name,
        params.arguments ?? {},
      );
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: toolResult,
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id: request.id, result: {} };
    default:
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `Unknown method: ${request.method}` },
      };
  }
}
// ── Public Export (for CLI) ──
export async function cmdMcpServe() {
  // Server is started by stdin listener above. This function is the CLI entry
  // point — it just needs to exist so the import works. The stdin handler
  // activates as soon as the module loads.
  process.stderr.write(
    `[agentdial-mcp] Server started. ${String(TOOLS.length)} tools available.\n`,
  );
}
//# sourceMappingURL=mcp-serve.js.map
