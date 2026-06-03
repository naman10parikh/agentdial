# agentdial — Memory

## Bootstrap (loaded every cycle)

- Strategy: Normalize → Route → Format. Every message through the same pipeline regardless of channel.
- Platform: Multi-channel gateway (Telegram, Discord, Slack, SMS, WhatsApp, Email, Voice)
- Created: 2026-03-01
- Protocol: AIP v1.0 (see PROTOCOL.md)
- Last successful routing: (updated by agent)
- Key learnings: (appended by agent)

## Patterns Discovered

- Telegram nested format: `{ update_id, message: { text, from, chat } }` — unwrap before normalizing.
- Twilio SMS/WhatsApp uses capital-F `Body` and `From` fields, not lowercase.
- Twilio voice uses `SpeechResult` for transcribed speech input.
- Slack timestamps are `"1234567890.000100"` (seconds with microseconds) — multiply by 1000 for ms.
- Discord uses `content` not `text`; userId field for sender.
- Empty text messages are valid — agent backend must handle them gracefully.

## Errors Encountered

- Twilio SMS/WhatsApp/Voice channels require credentials before serving webhooks — surface a clear error message via `channel_test` if creds missing.
- Platform webhooks must be HTTPS — use `agentdial serve --tunnel` (Cloudflare) for local dev.
- Discord.js is a peerDependency — runtime import fails if not installed. Guard with try/catch in adapter connect().
