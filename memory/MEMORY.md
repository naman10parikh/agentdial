# agentdial — Long-Term Memory (index)

> Inherited memory-harness structure from Energy. One line per durable fact.
> Layers: this index → topics/ deep-dives → daily/ logs → archive/ (compressed >30d, never deleted).

## Architecture Decisions

- AIP is the third protocol layer: MCP (tools) + A2A (collaboration) + **AIP (identity)**. agentdial is the reference implementation. See `PROTOCOL.md`.
- Two primitives only: `IDENTITY.md` (declarative identity, YAML+Markdown) and `GatewayMessage` (`{ id, channel, from, text, timestamp }`). The agent backend is any HTTP endpoint; contract is `{ text }` in → `{ text }` out.
- Gateway runs on port 3141; per-channel response formatting (Telegram Markdown / Discord embeds / Slack Block Kit / plain-text fallback) is mandated by spec §3.2.

## Key Patterns

- Add a channel = one inbound mapper + one outbound formatter in `src/adapters/`, normalizing to `GatewayMessage`. The agent backend never changes. Documented in `CONTRIBUTING.md`.
- Webhook signatures validated per platform (`src/lib/webhook-validation.ts`): Twilio HMAC-SHA1, Slack HMAC-SHA256 + replay protection, Telegram secret-token path.
- agentdial doubles as an MCP server (`agentdial mcp-serve`) so Claude Code manages channels as tools.

## Technology Choices

- TypeScript strict mode · `commander` CLI · `vitest` tests (58 cases, fully mocked) · Zod runtime validation at boundaries · `tsc` build.
- Channel backends: Twilio (SMS/WhatsApp/Voice), SendGrid + AgentMail (email), Telegram/Discord/Slack native bot APIs, Vapi (voice alt).

## People & Resources

- Reference impl + npm: `agentdial`. GitHub: `naman10parikh/agentdial`. License: MIT.

## What NOT to Do

- Never commit credentials. They live only in `~/.agentdial/credentials/<channel>.json` (`0600`/`0700`). Twilio/SendGrid appear only as `.env.example` placeholders.
- Never add live API calls to the test suite — keep it mocked and deterministic.

## Operating Model

- Maintainer's co-founder, not an assistant. Test as a USER (run the CLI, exercise a channel). Inherited rules in `.claude/rules/` are glob-loaded every session.

## Topic Files Index

- (none yet — add deep-dives under `memory/topics/` and index them here)
