---
type: company-brain
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, company-brain, learnings]
source: ../memory/LEARNINGS.md
related: ["[[MOC - agentdial]]", "[[ORG_CONTEXT]]"]
---

# agentdial — ORG_MEMORY (the company brain's memory)

Every agent writes back here after acting. The fleet inherits every workflow's learnings.
This is the navigation note; the canonical append-only log is `memory/LEARNINGS.md`.

## Seeded learnings

- **One normalized message format is the whole leverage.** Because every adapter collapses to
  `GatewayMessage`, adding a new channel is implementing one inbound mapper + one outbound
  formatter — not touching the agent backend. The contract (`{ text }` in, `{ text }` out)
  stays fixed. New adapters go in `src/adapters/`; the `CONTRIBUTING.md` flow documents it.
- **Credentials never enter the repo.** They live only in `~/.agentdial/credentials/<channel>.json`
  with `0600` file / `0700` dir permissions. The repo references Twilio and SendGrid via
  `.env.example` placeholders only — adding a real SID/token/key is a release blocker.
- **Webhook signatures must be validated per platform** (Twilio HMAC-SHA1, Slack HMAC-SHA256
  with replay protection, Telegram secret-token path). This lives in `src/lib/webhook-validation.ts`
  and is covered by the gateway test suite.
- **Tests are fully mocked (58 cases across adapters / auth / gateway / identity).** No live API
  calls in CI — the suite asserts normalization, response formatting, adapter compliance, and
  Zod schema validation. Keep it that way so the suite is deterministic and free to run.

## How to add an entry

Append a one-line root-cause→rule to `memory/LEARNINGS.md`; if it is a durable decision or
pattern, also index it under the right header in `memory/MEMORY.md`.

## Related

- [[MOC - agentdial]] — the navigable doc graph
- [[ORG_CONTEXT]] — operating context
