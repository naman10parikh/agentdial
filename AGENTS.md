# AGENTS.md: AgentDial

> The one set of instructions for every coding agent (Codex, Cursor, OpenCode, Copilot, Claude Code,
> Gemini CLI) and for people. `CLAUDE.md` and `GEMINI.md` import this file.

## What it does

AgentDial is the reference implementation of the **Agent Identity Protocol (AIP)**. One `IDENTITY.md`
file declares who an agent is. AgentDial stores each channel's credentials, runs a webhook gateway,
turns every inbound message from Telegram, Discord, Slack, SMS, WhatsApp, email or voice into one
`GatewayMessage` (`{ id, channel, from, text, timestamp }`), sends it to any HTTP agent backend, and
formats the reply for the channel it came from. The backend contract is `{ text }` in and `{ text }`
out. The full spec is [`PROTOCOL.md`](PROTOCOL.md); it also defines Teams, Messenger and a web widget
as channel types (section 1.3). Those, and iMessage, are planned: AgentDial has no adapter for them
yet. `channels add` enables nothing for `imessage` or `web`; a site can still reach the agent through `POST /message`.
Telegram, Discord and Slack need no payment details.

## Its tools and how to call them

**Command line.** Run `npx -y -p github:naman10parikh/agentdial agentdial <command>`, or `agentdial
<command>` after `npm i -g agentdial`. Every command has `--help`.

| Command | What it does |
| --- | --- |
| `setup [--file IDENTITY.md]` | Interactive wizard: create the identity and pick channels. |
| `quickstart` | From an API key to a live agent in one guided flow. |
| `channels add\|remove\|list\|test <channel>` | Manage one channel's configuration and check it. |
| `recipes`, `recipes run <channel>`, `recipes verify` | Guided per-platform setup, with a check at the end. |
| `serve [-p 3141] [-a <agent-url>] [--tunnel]` | Run the gateway. `--tunnel` opens a public HTTPS address for webhooks. |
| `status [--json]` | Show every channel's state. |
| `test [-c <channel>] [-m <text>]` | Send a test message through the full pipeline. |
| `voice setup`, `voice test -n <phone>` | Configure and test the Twilio voice channel. |
| `login`, `logout`, `whoami` | The optional AgentDial account (managed channels). |
| `mcp-serve` | Start the MCP server (same as the `agentdial-mcp` bin). |
| `memory-search <query> [--json]` | Search this repository's own knowledge with BM25 (memory, brain, docs). |
| `sandbox-run "<command>" [--json]` | Run untrusted code in an E2B microVM, never on the host. Needs `E2B_API_KEY`. |

**MCP server.** `npx -y -p github:naman10parikh/agentdial agentdial-mcp` speaks JSON-RPC over stdio.
In Claude Code: `claude mcp add --transport stdio agentdial -- npx -y -p github:naman10parikh/agentdial agentdial-mcp`.

| Tool | What it does | Required |
| --- | --- | --- |
| `identity_status` | Read the agent's identity from IDENTITY.md: name, tagline, version, channels, gateway. | - |
| `identity_setup` | Create or update IDENTITY.md. | name |
| `channel_add` | Add and enable a channel, optionally with credentials. A planned channel (`imessage`, `web`) is not enabled and saves nothing. | channel |
| `channel_remove` | Disable a channel. | channel |
| `channel_test` | Test one channel's credentials, or all of them. | - |
| `channel_list` | List every supported channel with status, cost and setup time. Planned channels show the status `planned`. | - |
| `gateway_start` | Start the gateway on a port; needs an agent URL. | - |
| `gateway_stop` | Stop the gateway. | - |
| `recipe_list` | List the setup recipes with friction tier, cost, steps and status. | - |
| `recipe_run` | Run one channel's recipe; returns the manual steps left. | channel |
| `recipe_verify` | Check every configured channel against its platform's API. | - |
| `auth_status`, `auth_login`, `auth_logout` | The optional AgentDial account session. | - |
| `auth_provision` | Provision managed channels for a signed-in user. | agent_name |
| `send_message` | Send text to a recipient on a configured channel. The main tool other agents call. | channel, to, text |

**Skills** (in [`skills/`](skills/)): `give-agent-identity` (put an agent on a channel),
`add-channel-adapter`, `add-mcp-tool` and `debug-webhook-signature` (for working on AgentDial itself).

**Sub-agents** (in `.claude/agents/`): `channel-adapter-reviewer` (reviews a channel adapter for AIP
compliance and webhook safety) and `identity-auditor` (audits an IDENTITY.md and reports which channels
are truly reachable), plus a general toolkit: `architect`, `code-reviewer`, `loop-auditor`,
`performance-analyzer`, `research-agent`, `security-reviewer`, `test-writer`. They read and report;
the parent edits.

## Where things live

| Path | What lives here |
| --- | --- |
| `src/index.ts`, `src/mcp.ts` | The two bins: `agentdial` (CLI) and `agentdial-mcp` (MCP server). |
| `src/commands/` | One file per CLI verb, including `mcp-serve.ts` (the 16 MCP tools). |
| `src/adapters/` | Per-platform inbound and outbound: telegram, discord, slack, twilio-sms, twilio-whatsapp, email (SendGrid), email-agentmail, voice (Twilio), voice-vapi. |
| `src/recipes/` | Guided per-channel setup flows. |
| `src/lib/` | gateway, identity, auth, credentials, webhook-validation, tunnel, run-log (observability), memory-index (BM25), sandbox (E2B). |
| `src/__tests__/`, `eval/` | 58 unit tests and 21 behavioral evals, all mocked, no network. |
| `identity/` | AgentDial's own SOUL, BRAND, HEARTBEAT and MEMORY. |
| `memory/`, `brain/` | Long-term memory (`MEMORY.md`, append-only `LEARNINGS.md`) and the Obsidian knowledge graph (hub: `brain/MOC - agentdial.md`). |
| `skills/`, `hooks/`, `.claude/` | Skills, the plugin's hooks, and the maintainer harness (rules, agents, settings). |
| `.claude-plugin/`, `gemini-extension.json`, `.well-known/agent-card.json` | Claude Code plugin, Gemini CLI extension, A2A agent card. |
| `dsip.json`, `scripts/improve.mjs`, `.github/workflows/` | The self-improvement contract, its loop, CI and the daily loop. |
| `docs/recipes/`, `templates/`, `landing/` | Channel recipes, the IDENTITY.md template, the landing page. |

## Build, test, run

```bash
npm install          # also builds dist/ (the prepare script)
npm test             # 79 cases: 58 unit + 21 behavioral evals
npm run eval         # the evals alone
npm run improve      # the self-improvement loop; writes logs/improve/latest.md
node dist/index.js --help
```

## Commit grammar

Conventional commits, scoped to the part touched, so a change reverts cleanly at skill, component or
release level: `feat(channel): <name>`, `feat(adapter): <platform>`, `feat(skill): <name>`,
`feat(recipe): <channel>`, `fix(gateway): ...`, `fix(webhook-validation): ...`, `docs: ...`, `test: ...`,
`chore: ...`.

## What not to do

- Never commit a credential. They live only in `~/.agentdial/credentials/<channel>.json` (folder
  `0700`, files `0600`). The repository carries `.env.example` placeholders only.
- Never read those files from an agent session; ask the CLI (`status`, `channels list`). The plugin's
  hook blocks it anyway.
- Never change the agent backend contract (`{ text }` in, `{ text }` out) to fit a channel.
- Never turn off webhook signature validation (Twilio HMAC-SHA1, Slack HMAC-SHA256 with replay
  protection, Telegram secret token).
- Never add live API calls to the tests; keep them mocked and deterministic.
- Never claim a channel is reachable until a real message has made the round trip.
