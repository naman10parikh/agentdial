import { randomUUID } from "node:crypto";
import { loadConfig } from "../lib/config.js";
import { routeMessage } from "../lib/gateway.js";
import { heading, success, error, info, warn } from "../lib/ui.js";
import { ChannelTypeSchema } from "../adapters/types.js";
export async function cmdTest(opts) {
  heading("Gateway Test");
  const config = await loadConfig();
  if (!config.agentUrl) {
    error("No agent URL configured.");
    info("Set it with: agentdial serve --agent-url <url>");
    info("Or add agent_url to your IDENTITY.md frontmatter.");
    return;
  }
  const channel = opts.channel ? ChannelTypeSchema.parse(opts.channel) : "web";
  const testMessage = {
    id: randomUUID(),
    channel,
    from: "agentdial-test",
    text: opts.message,
    timestamp: Date.now(),
  };
  info(`Sending to ${config.agentUrl}...`);
  info(`Channel: ${channel}`);
  info(`Message: "${opts.message}"`);
  try {
    const response = await routeMessage(testMessage, config.agentUrl);
    success("Agent responded:");
    console.log("");
    console.log(`  ${response.text}`);
    if (response.cards && response.cards.length > 0) {
      info(`${String(response.cards.length)} card(s) attached`);
    }
    if (response.actions && response.actions.length > 0) {
      info(`${String(response.actions.length)} action(s) attached`);
    }
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Test failed: ${msg}`);
    if (msg.includes("ECONNREFUSED")) {
      warn("Is your agent backend running?");
      info(`Expected at: ${config.agentUrl}`);
    }
  }
}
//# sourceMappingURL=test.js.map
