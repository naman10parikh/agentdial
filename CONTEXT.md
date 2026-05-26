# agentdial — Session Context

- **What:** Reference implementation of the Agent Identity Protocol (AIP). A CLI that gives an
  AI agent an identity across every channel (Telegram, Discord, Slack, SMS, WhatsApp, Email, Voice).
- **Status:** v1.2.1. Full agent-native harness layer added (rules, skills, hooks, sub-agents,
  memory, brain, identity, eval) on top of the shipping CLI.
- **Spec:** `PROTOCOL.md` (AIP v1.0). Public overview: `README.md`.
- **Build gate:** `pnpm install && pnpm build && pnpm test`, then `node dist/index.js --help`.
