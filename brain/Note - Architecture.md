---
type: architecture
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, architecture, gateway]
source: ../CLAUDE.md
related: ["[[MOC - agentdial]]", "[[Note - Channel Adapters]]", "[[Note - AIP Protocol]]"]
---

# Note — Architecture

Navigation note. Canonical map is `CLAUDE.md` → "Architecture (the product)" and the diagram
in `README.md`.

Flow: every channel (Telegram / Discord / Slack / SMS / WhatsApp / Email / Voice) feeds the
**agentdial gateway** (`src/lib/gateway.ts`, port 3141), which normalizes to `GatewayMessage`,
dispatches to **your agent backend** (any HTTP endpoint), then formats the `GatewayResponse`
back per channel. Source layout: `src/index.ts` (CLI entry), `src/commands/` (verbs),
`src/adapters/` (per-platform), `src/recipes/` (setup flows), `src/lib/` (gateway, identity,
auth, credentials, twilio, provisioning, tunnel, oauth-server, webhook-validation,
built-in-agent). Credentials stay in `~/.agentdial/credentials/`.

## Related

- [[MOC - agentdial]] · [[Note - Channel Adapters]] · [[Note - AIP Protocol]]
