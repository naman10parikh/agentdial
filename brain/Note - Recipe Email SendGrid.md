---
type: operations
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, recipe, email, sendgrid]
source: ../docs/recipes/email-sendgrid.md
related: ["[[MOC - agentdial]]", "[[Note - Channel Adapters]]"]
---

# Note — Recipe: Email (SendGrid)

Navigation note. **Navigate to `docs/recipes/email-sendgrid.md`** for the full walkthrough.

Gives an agent an email address: create a SendGrid API key, verify a sender (Single Sender or
Domain Authentication), configure via `agentdial setup` → email, test outbound, then optionally
wire Inbound Parse (MX record → `/webhook/email`) to receive mail. Responses render as styled
HTML. Notes the May-2025 SendGrid free-tier removal and AgentMail as an alternative. Includes
cost table, troubleshooting, and security notes (store key 0600, never commit).

## Related

- [[MOC - agentdial]] · [[Note - Channel Adapters]]
