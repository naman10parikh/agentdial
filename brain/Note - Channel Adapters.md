---
type: architecture
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, adapters, channels]
source: ../src/adapters/types.ts
related: ["[[MOC - agentdial]]", "[[Note - Architecture]]", "[[Note - AIP Protocol]]", "[[Note - Recipe Voice Twilio]]", "[[Note - Recipe Email SendGrid]]"]
---

# Note — Channel Adapters

Navigation note. Canonical source is `src/adapters/` (interface in `src/adapters/types.ts`).

Each adapter implements the `ChannelAdapter` contract: parse an inbound platform payload into a
`GatewayMessage`, and format a `GatewayResponse` into the platform's native shape. Shipping
adapters: `telegram`, `discord`, `slack`, `twilio-sms`, `twilio-whatsapp`, `email` (SendGrid),
`email-agentmail`, `voice` (Twilio), `voice-vapi`. Adding one is documented in `CONTRIBUTING.md`
(create file → implement interface → register → add a test). Per-channel formatting rules live
in `PROTOCOL.md` §3.2.

## Related

- [[MOC - agentdial]] · [[Note - Architecture]] · [[Note - AIP Protocol]] · [[Note - Recipe Voice Twilio]] · [[Note - Recipe Email SendGrid]]
