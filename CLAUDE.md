# agentdial — Agent-Native Harness

> One repo = one recursively self-improving, agent-native harness. This is the reference
> implementation of the **Agent Identity Protocol (AIP)** with a full inherited harness layer
> (rules, skills, hooks, sub-agents, memory, brain, identity, eval).

## What this is

**MCP gave agents tools. A2A gave agents collaboration. AIP gives agents identity.**

`agentdial` is a CLI that dials an AI agent into every communication platform from a single
`IDENTITY.md` file. One declarative identity → phone numbers, inboxes, and handles across
Telegram, Discord, Slack, SMS, WhatsApp, Email, and Voice. The protocol has two primitives:
`IDENTITY.md` (declarative identity) and `GatewayMessage` (a normalized cross-channel message
format). See `PROTOCOL.md` for the AIP v1.0 spec.

```bash
npx agentdial setup     # interactive — wire your agent into channels
agentdial serve         # run the gateway: receives webhooks, normalizes, dispatches to your backend
```

## Architecture (the product)

- `src/index.ts` — CLI entry (commander). Binary: `agentdial`.
- `src/commands/` — setup, serve, mcp-serve, login, quickstart, recipes, channels, status, test, voice.
- `src/adapters/` — per-platform inbound/outbound: telegram, discord, slack, twilio-sms, twilio-whatsapp, email (SendGrid), email-agentmail, voice (Twilio), voice-vapi. All normalize to `GatewayMessage`.
- `src/recipes/` — opinionated per-channel setup flows.
- `src/lib/` — gateway, identity, auth, credentials, twilio, provisioning, tunnel, oauth-server, webhook-validation, built-in-agent.
- Credentials live in `~/.agentdial/credentials/<channel>.json` (dir `0700`, files `0600`) — **never committed**.

## Harness components (the inherited formula)

`identity/` (SOUL/BRAND/HEARTBEAT) · `memory/` + `brain/` (Obsidian knowledge graph) ·
`tools/` · `skills/` + `.claude/skills` · `hooks/` + `.claude/hooks` ·
`.claude/agents` (sub-agents) · `.mcp.json` (MCP servers) · `eval/` (eval + observer).
Same formula every harness inherits — different data. Inherited rules in `.claude/rules/`
are glob-loaded every session.

## Operating model

You are the maintainer's co-founder, not an assistant. Act, don't ask. Self-improve every
session. Test as a USER (run the CLI, exercise a channel) — "it compiles" means nothing.
Never give up: when a tool fails, try a lateral approach.

## Build & test

```bash
pnpm install && pnpm build && pnpm test
node dist/index.js --help     # verify the CLI runs
```

## Commit convention

`feat(skill):` · `feat(adapter):` · `feat(channel):` — conventional commits, so git
snap-back works at skill / component / release granularity.
