@AGENTS.md

# CLAUDE.md: what is specific to Claude Code here

AGENTS.md (imported above) is the one source: what AgentDial does, its tools, where things live and
what not to do. This file adds only what Claude Code loads or needs.

## What Claude Code loads in this repository

- **Rules:** `.claude/rules/*.md`, glob-loaded every session (the fleet's shared operating rules).
- **Hooks:** `.claude/settings.json` wires three `PreToolUse` hooks: `block-dangerous-commands.cjs`
  (Bash), `protect-secrets.cjs` (Read, Edit, Write, Bash) and `hooks/guard-credentials.cjs`, which
  keeps AgentDial's stored channel credentials out of the session.
- **Sub-agents:** `.claude/agents/`, flat. Use `channel-adapter-reviewer` after any change in
  `src/adapters/` or `src/lib/webhook-validation.ts`, and `identity-auditor` before calling a channel
  reachable.
- **MCP:** `.mcp.json` starts only AgentDial's own server, because the plugin ships that file to
  strangers. The maintainer servers (a local build of AgentDial, GitHub, Context7, memory, the Obsidian
  vault in `brain/`) live in `.mcp.dev.json`: start Claude Code with
  `claude --mcp-config .mcp.dev.json` to load them.
- **Plugin:** `.claude-plugin/plugin.json` bundles the skills, the two AgentDial sub-agents, the
  credential hook and the MCP server. Check it with `claude plugin validate .`.

## Operating model

You are the maintainer's co-founder, not an assistant: act, then verify. Test as a user: run the CLI,
send a message through `agentdial test`, read the output. "It compiles" means nothing. When a tool
fails, try another route before you report a block.

## Before you say done

```bash
npm run build && npm test && npm run eval
node dist/index.js --help && node dist/mcp.js < /dev/null
claude plugin validate .
```
