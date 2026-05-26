---
type: moc
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [moc, agentdial, aip]
---

# MOC — agentdial

The master hub for this harness's brain. **agentdial** is the reference implementation of the
**Agent Identity Protocol (AIP)**: one declarative `IDENTITY.md` dials an AI agent into every
communication channel (Telegram, Discord, Slack, SMS, WhatsApp, Email, Voice) through a single
normalizing gateway. Every navigation note below links back here.

## Protocol & Spec

- [[Note - AIP Protocol]] — AIP v1.0 spec walkthrough (`PROTOCOL.md`): `IDENTITY.md`, `GatewayMessage`, `GatewayResponse`, gateway endpoints, webhook validation.
- Root spec file: `PROTOCOL.md` · Identity declaration: root `IDENTITY.md` · Template: `templates/IDENTITY.md`.

## Product Overview

- [[Note - README Overview]] — the OSS front door (`README.md`): install, channels table, architecture diagram, CLI command reference.
- [[Note - Architecture]] — how the gateway, adapters, and agent backend fit together.
- [[Note - Channel Adapters]] — the per-platform adapter inventory and the normalization contract.

## Channel Recipes (`docs/recipes/`)

- [[Note - Recipe Voice Twilio]] — give an agent a phone number (`docs/recipes/voice-twilio.md`).
- [[Note - Recipe Email SendGrid]] — give an agent an email address (`docs/recipes/email-sendgrid.md`).

## Company Brain

- [[ORG_CONTEXT]] — what this company/harness is and its operating context.
- [[ORG_MEMORY]] — what the fleet has learned (write-back log).

## Memory (source of truth: `memory/`)

- `memory/MEMORY.md` — long-term decisions, patterns, tech choices (index).
- `memory/LEARNINGS.md` — append-only error→root-cause→rule log.
- `memory/topics/`, `memory/daily/`, `memory/maintainer-prompts/`, `memory/archive/` — deep-dives, logs, prompts, compressed history.

## Contributing & Releases

- [[Note - Contributing]] — how to add a channel adapter (`CONTRIBUTING.md`).
- Root: `CHANGELOG.md` (release history) · `TODO.md` (roadmap) · `LICENSE` (MIT) · `CLAUDE.md` (agent operating brief) · `CONTEXT.md` (session state) · `QUICKSTART.md` (inline commands) · `AGENTS.md` (this repo's orchestration conventions).

## Top-level folders (every folder named)

| Folder        | Purpose                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `src/`        | Product source — CLI, gateway, adapters, recipes, lib, tests.                    |
| `docs/`       | Channel setup recipes.                                                           |
| `templates/`  | `IDENTITY.md` template used by `agentdial setup`.                                |
| `landing/`    | Static landing page.                                                             |
| `identity/`   | This repo's own agent-harness identity (SOUL/BRAND/HEARTBEAT/MEMORY).            |
| `memory/`     | Long-term memory layers.                                                         |
| `brain/`      | This Obsidian knowledge graph (navigation layer; `obsidian` MCP vault).          |
| `eval/`       | Eval + observer harness (seeded empty).                                          |
| `skills/`     | Project-local skill extension point (seeded empty; active set in `.claude/`).    |
| `hooks/`      | Project-local hook extension point (seeded empty; active set in `.claude/`).     |
| `tools/`      | Project-local tool extension point (seeded empty).                               |
| `scripts/`    | Maintenance scripts (memory, doc-health, budget, auto-switch).                   |
| `.claude/`    | Inherited harness: rules, skills, hooks, sub-agents, slash commands.             |
| `.github/`    | CI workflow.                                                                     |

## Related

- [[ORG_CONTEXT]] · [[ORG_MEMORY]]
