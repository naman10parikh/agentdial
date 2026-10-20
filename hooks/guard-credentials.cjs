#!/usr/bin/env node
/**
 * guard-credentials: a PreToolUse hook for Read, Edit, Write and Bash.
 *
 * AgentDial keeps every channel's credentials in ~/.agentdial/credentials/<channel>.json
 * and the login session in ~/.agentdial/auth.json. An agent never needs to read them:
 * the CLI and the MCP server load them itself. This hook denies any tool call that would
 * read, change, copy or print those files, so a token never enters the agent's context.
 *
 * Input: the hook JSON on stdin. Output: {} to allow, or a deny decision.
 * Test: echo '{"tool_name":"Read","tool_input":{"file_path":"~/.agentdial/auth.json"}}' | node hooks/guard-credentials.cjs
 */
const GUARDED = /\.agentdial\/(credentials(\/|\b)|auth\.json)/;
const READERS = /\b(cat|less|more|head|tail|bat|cp|mv|scp|rsync|base64|xxd|strings|grep|sed|awk|jq|open)\b/;

function decide(tool, input) {
  if (["Read", "Edit", "Write"].includes(tool)) {
    return GUARDED.test(String(input?.file_path ?? "")) ? "a channel credential file" : null;
  }
  if (tool === "Bash") {
    const cmd = String(input?.command ?? "");
    return GUARDED.test(cmd) && READERS.test(cmd) ? "a command that reads a channel credential file" : null;
  }
  return null;
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    process.stdout.write("{}\n");
    return;
  }
  const what = decide(data.tool_name, data.tool_input);
  if (!what) {
    process.stdout.write("{}\n");
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `AgentDial guard: blocked ${what}. Use \`agentdial status\` or \`agentdial channels list\`; ` +
          "they report each channel without exposing its token.",
      },
    }) + "\n",
  );
});
