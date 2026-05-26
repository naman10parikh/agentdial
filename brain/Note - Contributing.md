---
type: operations
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, contributing, adapters]
source: ../CONTRIBUTING.md
related: ["[[MOC - agentdial]]", "[[Note - Channel Adapters]]"]
---

# Note — Contributing

Navigation note. **Navigate to `CONTRIBUTING.md`** for the full guide.

Setup (`git clone` → `pnpm install` → `pnpm build`) plus the canonical recipe for adding a new
channel adapter: create `src/adapters/{channel}.ts`, implement the `ChannelAdapter` interface
(inbound→`GatewayMessage`, `GatewayResponse`→native), register it, and add a test. This is the
extension path that keeps the agent backend contract fixed while the channel surface grows.

## Related

- [[MOC - agentdial]] · [[Note - Channel Adapters]]
