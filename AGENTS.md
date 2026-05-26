# AGENTS.md — agentdial Orchestration Conventions

> How agents (Claude Code, sub-agents, CI) work inside THIS repo. Repo-specific —
> not a generic wiki schema. agentdial is the reference implementation of the
> **Agent Identity Protocol (AIP)**: one `IDENTITY.md` → an agent reachable on every channel.

## What this repo is

`agentdial` is a TypeScript CLI + gateway. It reads a declarative `IDENTITY.md`, provisions
per-channel credentials, runs a webhook gateway that normalizes every inbound message to a
single `GatewayMessage`, dispatches to any HTTP agent backend, and formats the
`GatewayResponse` per channel. The protocol it implements is specified in `PROTOCOL.md`.

## Directory map (where things live)

| Path           | What lives here                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`         | All product source (TypeScript, strict mode).                                                                                                  |
| `src/commands/`| CLI verbs: `setup`, `serve`, `mcp-serve`, `login`, `quickstart`, `recipes`, `channels`, `status`, `test`, `voice`, `channel-flows`.            |
| `src/adapters/`| Per-platform inbound/outbound: `telegram`, `discord`, `slack`, `twilio-sms`, `twilio-whatsapp`, `email` (SendGrid), `email-agentmail`, `voice` (Twilio), `voice-vapi`. Each normalizes to `GatewayMessage` and formats `GatewayResponse`. |
| `src/recipes/` | Opinionated per-channel setup flows (the wizard's scripted paths).                                                                             |
| `src/lib/`     | `gateway`, `identity`, `auth`, `credentials`, `config`, `twilio`, `provisioning`, `tunnel`, `oauth-server`, `webhook-validation`, `slack-manifest`, `built-in-agent`, `ui`, `constants`. |
| `src/__tests__/`| Vitest suites — `adapters`, `auth`, `gateway`, `identity` (58 cases, all mocked, no live API calls).                                          |
| `docs/`        | Channel recipes (`docs/recipes/voice-twilio.md`, `docs/recipes/email-sendgrid.md`).                                                            |
| `templates/`   | `IDENTITY.md` template scaffolded by `agentdial setup`.                                                                                         |
| `landing/`     | Static landing page (`landing/index.html`).                                                                                                    |
| `identity/`    | This repo's own agent-harness identity: `SOUL.md`, `BRAND.md`, `HEARTBEAT.md`, `MEMORY.md`.                                                     |
| `memory/`      | Long-term memory: `MEMORY.md` (index), `LEARNINGS.md` (append-only), `topics/`, `daily/`, `maintainer-prompts/`, `archive/`.                      |
| `brain/`       | Obsidian knowledge graph (navigation layer). Hub: `brain/MOC - agentdial.md`. `obsidian` MCP `VAULT_PATH` points here.                          |
| `eval/`        | Eval + observer harness (seeded empty; see `eval/README.md`).                                                                                   |
| `skills/` `hooks/` `tools/` | Project-local harness extension points (seeded empty; the active inherited set lives under `.claude/`).                            |
| `.claude/`     | Inherited harness: `rules/` (glob-loaded every session), `skills/`, `hooks/`, `agents/` (sub-agents), `commands/` (slash commands).            |
| `scripts/`     | Maintenance: `memory-compress`, `memory-search`, `doc-health-check`, `budget-manager`, `auto-switch`.                                           |
| `.github/`     | CI (`.github/workflows/ci.yml`).                                                                                                                |

## Sub-agents (research / review only — parent implements)

Under `.claude/agents/agents/`: `code-reviewer`, `security-reviewer`, `architect`,
`performance-analyzer`, `research-agent`, `test-writer`, `loop-auditor`. Spawn them to
audit an adapter or design a new channel; they do not write product code directly.

## Channels (the product surface)

Telegram · Discord · Slack · SMS (Twilio) · WhatsApp (Twilio) · Email (SendGrid / AgentMail) ·
Voice (Twilio / Vapi). Spec-defined types also include Teams, Messenger, and Web widget
(`PROTOCOL.md` §1.3). Telegram, Discord, and Slack need no payment info.

## Build, test, run

```bash
pnpm install && pnpm build && pnpm test   # tsc, then 58 Vitest cases
node dist/index.js --help                 # verify the CLI runs as a user would
```

## Commit grammar (so git snap-back works at the right granularity)

Conventional commits, scoped to the harness component touched:

- `feat(channel): <name>` — a new channel surface
- `feat(adapter): <platform>` — a platform inbound/outbound implementation
- `feat(skill): <name>` — a `.claude/skills` capability
- `feat(recipe): <channel>` — a guided setup flow
- `fix(gateway): …` · `fix(webhook-validation): …` · `docs: …` · `test: …` · `chore: …`

This lets a maintainer revert at skill / component / release granularity.

## Secrets — never commit

Credentials live ONLY in `~/.agentdial/credentials/<channel>.json` (dir `0700`, files `0600`),
never in the repo. agentdial integrates Twilio and SendGrid — in this repo those appear as
`.env.example` placeholders only. Never add a real token, SID, or API key.

See `brain/MOC - agentdial.md` for the navigable doc graph.
