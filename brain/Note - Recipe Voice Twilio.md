---
type: operations
status: active
created: 2026-05-25
updated: 2026-05-25
tags: [agentdial, recipe, voice, twilio]
source: ../docs/recipes/voice-twilio.md
related: ["[[MOC - agentdial]]", "[[Note - Channel Adapters]]"]
---

# Note — Recipe: Voice (Twilio)

Navigation note. **Navigate to `docs/recipes/voice-twilio.md`** for the full walkthrough.

Gives an agent a phone number: buy a Twilio number, configure via `agentdial voice setup`,
`agentdial serve --tunnel` to expose a public webhook, then call in. TwiML `<Gather>`/`<Say>`
loop transcribes speech, routes through the same gateway as chat, and synthesizes the reply
(Polly built-in, or ElevenLabs/Deepgram). Includes cost table (~$0.02–0.10/min),
troubleshooting, and manual webhook setup.

## Related

- [[MOC - agentdial]] · [[Note - Channel Adapters]]
