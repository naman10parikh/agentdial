---
type: architecture
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, aip, protocol, spec]
source: ../PROTOCOL.md
related: ["[[MOC - agentdial]]", "[[Note - Channel Adapters]]", "[[Note - Architecture]]"]
---

# Note — AIP Protocol (v1.0)

Navigation note. **Navigate to `PROTOCOL.md` — don't duplicate it.**

The Agent Identity Protocol spec defines two primitives and one gateway:

- **`IDENTITY.md`** (§1) — declarative agent identity: required `name`/`version`, optional
  `tagline`/`agent_url`/`channels`/`gateway`; the Markdown body doubles as a system prompt.
  Channel types (§1.3): telegram, discord, slack, sms, whatsapp, email, voice, teams,
  messenger, web.
- **`GatewayMessage`** (§2) — normalized inbound `{ id, channel, from, text, timestamp, … }`
  with normalization rules (native id, platform sender, plain text, epoch-seconds).
- **`GatewayResponse`** (§3) — what the backend returns (`text` + optional `cards`/`actions`),
  formatted per channel (§3.2). Gateway endpoints + webhook validation (§4), credential
  storage (§5), reference impl (§6).

## Related

- [[MOC - agentdial]] · [[Note - Channel Adapters]] · [[Note - Architecture]]
