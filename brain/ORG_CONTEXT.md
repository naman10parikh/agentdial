---
type: company-brain
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, company-brain, aip]
source: ../CLAUDE.md
related: ["[[MOC - agentdial]]", "[[ORG_MEMORY]]"]
---

# agentdial — ORG_CONTEXT (the company brain's context)

Every agent reads this before acting. "If it is recorded, it happened to the AI."

## What this is

agentdial is the reference implementation of the **Agent Identity Protocol (AIP)** — the
third layer of the agent protocol stack. MCP gave agents tools; A2A gave agents collaboration;
AIP gives agents *identity*. The thesis: agents are the new employees, so they need phone
numbers, inboxes, and handles — not just API keys. Today every platform reinvents this (Twilio
for SMS, Discord.js for chat, Slack SDK for work, SendGrid for email), so giving one agent a
presence means wiring up roughly fifteen APIs. AIP collapses that into one file.

## The two primitives

AIP defines exactly two things, both specified in `PROTOCOL.md`. `IDENTITY.md` is a single
markdown file with YAML frontmatter that declares who the agent is, where its backend lives,
and which channels it speaks on — human-readable and machine-parseable. `GatewayMessage` is a
normalized `{ id, channel, from, text, timestamp }` schema that flattens Telegram, Discord,
Slack, SMS, WhatsApp, email, and voice into one shape, so the agent backend handles one format
and agentdial handles the rest.

## How it runs

The agent backend is any plain HTTP endpoint: it receives a JSON `GatewayMessage` and returns
`{ text: "..." }` — that is the entire contract. The `agentdial` CLI provisions per-channel
credentials (stored only in `~/.agentdial/credentials/<channel>.json`, never in the repo),
runs the gateway on port 3141, validates inbound webhook signatures, and formats each
`GatewayResponse` appropriately per channel (Telegram Markdown, Discord embeds, Slack Block
Kit, plain-text fallback). It also ships as an MCP server (`agentdial mcp-serve`) so Claude
Code can manage channels directly.

## Operating model

This repo is itself an agent-native harness: the maintainer is the co-founder, not an
assistant. Act, don't ask; self-improve every session; test as a USER by actually running the
CLI and exercising a channel — "it compiles" means nothing. The inherited rule set in
`.claude/rules/` is glob-loaded every session and governs behavior.

## Related

- [[MOC - agentdial]] — the navigable doc graph
- [[ORG_MEMORY]] — what the fleet has learned
