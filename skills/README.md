# skills/

AgentDial's own skills, one folder per skill (`skills/<name>/SKILL.md`). The Claude Code plugin loads
this folder, and any agent that reads Agent Skills can install one skill from it.

| Skill | Use it when |
| --- | --- |
| [give-agent-identity](give-agent-identity/SKILL.md) | You want people to reach an agent on Telegram, Discord, Slack, SMS, WhatsApp, email or voice. |
| [add-channel-adapter](add-channel-adapter/SKILL.md) | You are adding a new platform to AgentDial itself. |
| [add-mcp-tool](add-mcp-tool/SKILL.md) | You are exposing a new AgentDial capability over MCP. |
| [debug-webhook-signature](debug-webhook-signature/SKILL.md) | A real webhook gets a 403 or the agent never replies. |

The skills under `.claude/skills/` are a general maintainer toolkit shared across the fleet; the four
above are written for AgentDial's job.
