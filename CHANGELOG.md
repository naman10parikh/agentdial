# Changelog

## Unreleased

### Fixed

- **Planned channels are marked as planned.** `imessage` and `web` were listed as channels, but neither has an adapter. `channels list` and the MCP tool `channel_list` now show them as planned. `channels add` and `channel_add` enable nothing and save no credentials for them. `setup` no longer enables `web` by default, and the channel names in help text and errors carry "(planned)". A site can still reach the agent through the gateway's `POST /message`.

## 1.0.0 (2026-03-28)

Initial release.

### Features

- **Agent Identity Protocol (AIP) v1.0** -- single `IDENTITY.md` file defines agent name, personality, channels, and backend URL with YAML frontmatter
- **7 channel adapters** -- Telegram, Discord, Slack, SMS, WhatsApp, Email, Voice. (This line first said 10 and also listed Teams, Messenger and a web widget; those never shipped and are planned.)
- **Unified gateway** -- normalizes all incoming messages to `GatewayMessage` format and routes to any HTTP agent backend
- **Per-channel response formatting** -- Markdown for Telegram, embeds for Discord, blocks for Slack, plain text fallback
- **Interactive setup wizard** -- `agentdial setup` guides through identity creation and channel configuration
- **Secure credential storage** -- per-channel JSON files in `~/.agentdial/credentials/` with 0600 permissions
- **Voice support** -- Twilio-based voice calls with speech-to-text and text-to-speech
- **Rich responses** -- cards with images, action buttons (URL, callback, reply), and metadata
- **MCP server mode** -- `agentdial mcp-serve` integrates with Claude Code as a tool provider
- **Channel management CLI** -- add, remove, list, and test channels individually or all at once
- **Zod-validated schemas** -- all message types, configs, and identity files validated at runtime
- **Zero lock-in** -- agent backend is any HTTP endpoint that accepts JSON POST requests
