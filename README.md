# Agent Identity Protocol (AIP)

[![npm version](https://img.shields.io/npm/v/agentdial.svg)](https://www.npmjs.com/package/agentdial)
[![Protocol: AIP v1.0](https://img.shields.io/badge/Protocol-AIP%20v1.0-blueviolet.svg)](#identitymd-spec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#tests)
[![Downloads](https://img.shields.io/npm/dm/agentdial.svg)](https://www.npmjs.com/package/agentdial)

**MCP gave agents tools. A2A gave agents collaboration. AIP gives agents identity.**

Agents are the new employees. They need phone numbers, inboxes, and handles -- not just API keys. Today every platform reinvents this: Twilio for SMS, Discord.js for chat, Slack SDK for work, SendGrid for email. Fifteen APIs to give one agent a presence.

AIP is a protocol. `IDENTITY.md` is the spec. `agentdial` is the CLI.

```bash
npx agentdial setup
```

```
  ┌────────────────────────────────────────┐
  │ Agent: Spark                           │
  │ Tagline: Your AI concierge             │
  │ Backend: http://localhost:8080/agent    │
  └────────────────────────────────────────┘

  Channel          Status    Cost     Setup
  ────────────────  ────────  ───────  ─────
  Telegram Bot      active   Free     2 min
  Discord Bot       active   Free     3 min
  Slack App         ready    Free     5 min
  SMS (Twilio)      ----     ~$0.01   5 min
  Voice (Twilio)    ----     ~$0.01   5 min
```

One file. Seven channels. Your agent has an identity.

## The Protocol Stack

| Protocol | Solves              | Spec                          | Reference Impl    |
| -------- | ------------------- | ----------------------------- | ----------------- |
| **MCP**  | Tool access         | Tool schemas (JSON)           | SDK + CLI         |
| **A2A**  | Agent collaboration | Agent Cards (JSON)            | SDK + server      |
| **AIP**  | Agent identity      | `IDENTITY.md` (YAML+Markdown) | SDK + `agentdial` |

AIP defines two primitives:

- **`IDENTITY.md`** -- a single markdown file with YAML frontmatter that declares who your agent is, where it lives, and which channels it speaks on. Human-readable. Machine-parseable. Portable.
- **`GatewayMessage`** -- a normalized message format (`{ id, channel, from, text, timestamp }`) that collapses Telegram, Discord, Slack, SMS, WhatsApp, email, and voice into one schema. Your agent handles one format. agentdial handles the rest.

## Install

```bash
npm install -g agentdial
```

Or run directly:

```bash
npx agentdial setup
```

**Requirements:** Node.js >= 18 | **Platforms:** macOS, Linux, Windows (WSL)

## Quick Start

```bash
# 1. Create identity + pick channels
agentdial setup

# 2. Add a channel
agentdial channels add telegram

# 3. Start the gateway
agentdial serve --agent-url http://localhost:8080/agent
```

Your agent is live on Telegram. Add more channels anytime with `agentdial channels add <channel>`.

## Channels

| Channel           | Cost        | Setup  | Credentials                |
| ----------------- | ----------- | ------ | -------------------------- |
| Telegram Bot      | Free        | 2 min  | Bot token from @BotFather  |
| Discord Bot       | Free        | 3 min  | Bot token + application ID |
| Slack App         | Free        | 5 min  | Bot token + signing secret |
| SMS (Twilio)      | ~$0.008/msg | 5 min  | Account SID + auth token   |
| WhatsApp (Twilio) | ~$0.005/msg | 10 min | Account SID + auth token   |
| Email (SendGrid)  | Free trial  | 3 min  | API key + verified sender  |
| Voice (Twilio)    | ~$0.013/min | 5 min  | Account SID + auth token   |

Telegram, Discord, and Slack need zero payment info.

## Architecture

```
  Telegram ──┐
  Discord  ──┤                    ┌──────────────────┐
  Slack    ──┤   ┌────────────┐   │                  │
  SMS      ──┼──>│  agentdial │──>│  Your Agent      │
  WhatsApp ──┤   │  Gateway   │   │  Backend         │
  Email    ──┤   │  :3141     │   │  (any HTTP)      │
  Voice    ──┘   └────────────┘   └──────────────────┘
                       │
                       │  GatewayMessage (normalized)
                       │  { id, channel, from, text, timestamp }
                       │
                       │  GatewayResponse (per-channel)
                       │  Telegram: Markdown + inline keyboards
                       │  Discord:  Embeds + components
                       │  Slack:    Blocks + actions
                       └  Others:   Plain text fallback
```

Your agent backend is a plain HTTP endpoint. It receives a JSON `GatewayMessage`, returns `{ text: "..." }`. That's the entire contract.

## IDENTITY.md Spec

The **Agent Identity Protocol v1.0** spec. YAML frontmatter is machine-readable. Markdown body is human-readable context (usable as a system prompt).

```yaml
---
name: spark
tagline: Your AI concierge
version: "1.0.0"
agent_url: http://localhost:8080/agent
channels:
  telegram:
    enabled: true
    handle: "@spark_bot"
  discord:
    enabled: true
    handle: "Spark#1234"
  slack:
    enabled: true
  web:
    enabled: true
---

# Spark

> Your AI concierge

## Personality

- Friendly and knowledgeable
- Concise but thorough

## Capabilities

- Restaurant recommendations and reservations
- Event discovery and booking

## Boundaries

- No financial transactions
- No medical or legal advice
```

## Claude Code Integration

agentdial ships as an MCP server for Claude Code:

```json
{
  "mcpServers": {
    "agentdial": {
      "command": "npx",
      "args": ["-y", "agentdial", "mcp-serve"]
    }
  }
}
```

This gives Claude Code tools to manage channels, test connections, and check agent status.

## Voice

```bash
agentdial voice setup
agentdial voice test --number +15551234567
```

Calls are transcribed, routed through the same gateway as chat, and responses are synthesized back to speech via Twilio.

## Configuration

```
~/.agentdial/
├── config.json          # Gateway port, log level, identity path
├── credentials/         # Per-channel credentials (0600 permissions)
│   ├── telegram.json
│   ├── discord.json
│   └── twilio.json
├── templates/           # Identity file templates
└── logs/                # Gateway logs
```

Credentials never touch your project directory or git.

## Commands

```
SETUP
  agentdial setup                      Interactive wizard
  agentdial setup --file ./agent.md    Use existing identity file

CHANNELS
  agentdial channels add <channel>     Add a channel
  agentdial channels remove <channel>  Remove a channel
  agentdial channels list              List all channels
  agentdial channels test [channel]    Test connectivity

VOICE
  agentdial voice setup                Configure Twilio voice
  agentdial voice test -n <phone>      Test call

GATEWAY
  agentdial serve                      Start gateway (port 3141)
  agentdial serve -p 8080             Custom port
  agentdial serve -a http://my-agent  Custom backend

STATUS
  agentdial status                     Show channel statuses
  agentdial status --json              Machine-readable output

TEST
  agentdial test                       Test full pipeline
  agentdial test -c telegram -m "hi"   Test specific channel

MCP
  agentdial mcp-serve                  Start as MCP server
```

## Tests

```bash
cd tools/agentdial && pnpm test
```

Covers identity parsing, gateway normalization, response formatting, adapter compliance, and Zod schema validation. All mocked -- no real API calls.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
