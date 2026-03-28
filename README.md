# agentdial

[![npm version](https://img.shields.io/npm/v/agentdial.svg)](https://www.npmjs.com/package/agentdial)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20WSL-blue.svg)](#supported-channels)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#tests)
[![Downloads](https://img.shields.io/npm/dm/agentdial.svg)](https://www.npmjs.com/package/agentdial)

**Dial your AI agent into every platform.**

One identity file. Seven channels. Zero boilerplate.

```bash
npx agentdial setup
```

```
   ___                    __  ____  _       __
  / _ |___ ____ ___  ____/ / / __ \(_)___ _/ /
 / __ / _ `/ -_) _ \/ __/ / / / / / / _ `/ /
/_/ |_\_, /\__/_//_/\__/_/ /_/ /_/_/\_,_/_/
     /___/

  v1.0.0 One identity. Every channel.

  ┌────────────────────────────────────────┐
  │ Agent Identity                         │
  ├────────────────────────────────────────┤
  │ Name:     Spark                        │
  │ Tagline:  Your AI concierge            │
  │ Backend:  http://localhost:8080/agent   │
  └────────────────────────────────────────┘

  Channel          Status    Cost     Setup
  ────────────────  ────────  ───────  ─────
  Telegram Bot      active   Free     2 min
  Discord Bot       active   Free     3 min
  Slack App         ready    Free     5 min
  SMS (Twilio)      ----     ~$0.01   5 min
  Web Widget        active   Free     1 min
```

agentdial gives your AI agent a single identity file (`IDENTITY.md`) and connects it to Telegram, Discord, Slack, SMS, WhatsApp, email, and voice -- through one unified gateway.

## Install

```bash
npm install -g agentdial
```

Or run directly:

```bash
npx agentdial setup
```

**Requirements:** Node.js >= 18 &middot; **Supports:** macOS, Linux, Windows (WSL)

## Quick Start

Three steps. Two minutes.

```bash
# 1. Create your agent identity + pick channels
agentdial setup

# 2. Add a channel (interactive credential prompts)
agentdial channels add telegram

# 3. Start the gateway
agentdial serve --agent-url http://localhost:8080/agent
```

Your agent is now live on Telegram. Add more channels anytime with `agentdial channels add <channel>`.

## Why agentdial?

Every AI agent needs to talk to users. Today that means:

- **5-15 separate API integrations** (Telegram Bot API, Discord.js, Slack SDK, Twilio, SendGrid...)
- **Hundreds of lines of boilerplate** per channel (webhook setup, message normalization, response formatting)
- **No standard identity format** -- every platform represents your agent differently
- **Credential sprawl** -- API keys scattered across env files, dashboards, and config files

agentdial solves this with:

- **One identity file** (`IDENTITY.md`) that defines your agent's name, personality, and channel config
- **One gateway** that normalizes all incoming messages to a single `GatewayMessage` format
- **One response format** (`GatewayResponse`) that agentdial translates per-channel (Markdown for Telegram, embeds for Discord, blocks for Slack)
- **Secure credential storage** in `~/.agentdial/credentials/` with 0600 permissions
- **Zero lock-in** -- your agent backend is a plain HTTP endpoint that receives JSON

## Supported Channels

| Channel           | Cost           | Setup Time | Credentials Needed         |
| ----------------- | -------------- | ---------- | -------------------------- |
| Telegram Bot      | Free           | 2 min      | Bot token from @BotFather  |
| Discord Bot       | Free           | 3 min      | Bot token + application ID |
| Slack App         | Free           | 5 min      | Bot token + signing secret |
| SMS (Twilio)      | ~$0.0079/msg   | 5 min      | Account SID + auth token   |
| WhatsApp (Twilio) | ~$0.005/msg    | 10 min     | Account SID + auth token   |
| Email (SendGrid)  | 60-day trial\* | 3 min      | API key + verified sender  |
| Voice (Twilio)    | ~$0.013/min    | 5 min      | Account SID + auth token   |

Free channels (Telegram, Discord) need zero payment info. Paid channels use Twilio or SendGrid with usage-based pricing. \*SendGrid free tier was removed May 2025; 60-day trial (100 emails/day), then $19.95/mo.

### Coming Soon

| Channel            | Status  |
| ------------------ | ------- |
| Microsoft Teams    | Planned |
| Facebook Messenger | Planned |
| Web Widget         | Planned |

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
                       │ Normalizes all messages to:
                       │ { id, channel, from, text, timestamp }
                       │
                       │ Formats responses per-channel:
                       │ Telegram: Markdown + inline keyboards
                       │ Discord:  Embeds + components
                       │ Slack:    Blocks + actions
                       └ Others:   Plain text fallback
```

The gateway runs on port 3141 by default. Every incoming message from any channel is normalized into a `GatewayMessage`, forwarded to your agent backend as a POST request, and the response is formatted back into the channel's native format.

Your agent backend just needs one endpoint that accepts a JSON body and returns `{ text: "..." }`.

## IDENTITY.md Spec

agentdial introduces the **Agent Identity Protocol (AIP) v1.0** -- a single markdown file that defines your agent across all platforms.

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
- Uses casual tone with professional substance

## Capabilities

- Restaurant recommendations and reservations
- Event discovery and booking
- Local area knowledge

## Boundaries

- No financial transactions
- No medical or legal advice
- No personal data retention beyond the session
```

The YAML frontmatter is machine-readable. The markdown body is human-readable context your agent can use as a system prompt. The `channels` block declares which platforms your agent is active on.

## Claude Code Integration

agentdial ships as an MCP server for Claude Code. Add it to your project's `.mcp.json`:

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

This gives Claude Code tools to manage channels, test connections, and check agent status without leaving the terminal.

Start the MCP server standalone:

```bash
agentdial mcp-serve
```

## Voice

Voice channels use Twilio for telephony. Configure with:

```bash
agentdial voice setup
```

This prompts for your Twilio Account SID, Auth Token, and phone number. Test with:

```bash
agentdial voice test --number +15551234567
```

Voice calls are transcribed to text, sent through the same gateway pipeline as chat messages, and the response is synthesized back to speech via Twilio.

## Configuration

All config and credentials are stored locally:

```
~/.agentdial/
├── config.json          # Gateway port, log level, identity file path
├── credentials/         # Per-channel credential files (0600 permissions)
│   ├── telegram.json
│   ├── discord.json
│   ├── slack.json
│   └── twilio.json
├── templates/           # Identity file templates
└── logs/                # Gateway logs
```

Example `config.json`:

```json
{
  "identityFile": "IDENTITY.md",
  "gatewayPort": 3141,
  "logLevel": "info"
}
```

Credentials are never stored in your project directory or committed to git. The `credentials/` directory is created with 0700 permissions, and individual credential files with 0600.

## All Commands

```
SETUP
  agentdial setup                      Interactive wizard (identity + channels)
  agentdial setup --file ./agent.md    Use existing identity file

CHANNELS
  agentdial channels add <channel>     Configure a new channel
  agentdial channels remove <channel>  Remove a channel
  agentdial channels list              Show all channels and status
  agentdial channels test [channel]    Test one or all channels

VOICE
  agentdial voice setup                Configure Twilio voice
  agentdial voice test -n <phone>      Test call to a number

GATEWAY
  agentdial serve                      Start the gateway (port 3141)
  agentdial serve -p 8080              Custom port
  agentdial serve -a http://my-agent   Point to agent backend

STATUS
  agentdial status                     Show all channel statuses
  agentdial status --json              Machine-readable output

TEST
  agentdial test                       Send test message through gateway
  agentdial test -c telegram -m "hi"   Test specific channel

MCP
  agentdial mcp-serve                  Start as MCP server for Claude Code
```

## Tests

```bash
cd tools/agentdial && pnpm test
```

Tests cover identity parsing/validation, gateway message normalization, response formatting, adapter interface compliance, and Zod schema validation. All tests use mocks -- no real API calls.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding adapters, running tests, and submitting PRs.

## See Also

- **[agentgrid](https://github.com/naman10parikh/agentgrid)** -- Spawn grids of AI coding agents in parallel terminal panes
- **[Energy](https://github.com/naman10parikh/Energy)** -- Self-improving agent platform. agentdial is part of the Energy toolkit
- **[Model Context Protocol](https://modelcontextprotocol.io)** -- The MCP standard agentdial integrates with
- **[Google A2A](https://google.github.io/A2A/)** -- Agent-to-Agent protocol for inter-agent communication

## License

MIT -- see [LICENSE](LICENSE).
