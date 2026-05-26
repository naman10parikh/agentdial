# agentdial — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-05-25 — Seeded learnings

- **Normalize once, format per channel.** Collapsing all inbound traffic to `GatewayMessage` is the entire leverage of AIP — it keeps the agent backend channel-agnostic (`{ text }` in → `{ text }` out). Rule: a new channel = one inbound mapper + one outbound formatter in `src/adapters/`; never push channel specifics into the backend contract.
- **Credentials never enter the repo.** Root cause of most secret leaks is config files committed by habit. Rule: credentials live only in `~/.agentdial/credentials/<channel>.json` (`0600` files, `0700` dir); the repo carries Twilio/SendGrid as `.env.example` placeholders only — a real token/SID/key is a release blocker.
- **Validate every inbound webhook signature.** An unauthenticated `/webhook/:channel` is an open relay. Rule: enforce Twilio HMAC-SHA1, Slack HMAC-SHA256 (+ timestamp replay protection), and Telegram secret-token path validation in `src/lib/webhook-validation.ts`, covered by the gateway suite.
- **Keep the test suite fully mocked.** Live API calls make CI flaky and cost money. Rule: the 58 Vitest cases (adapters / auth / gateway / identity) assert normalization, formatting, adapter compliance, and Zod validation with mocks only — no network.
