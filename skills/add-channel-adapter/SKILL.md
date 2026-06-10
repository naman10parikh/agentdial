---
name: add-channel-adapter
description: Wire a new communication platform into agentdial as an AIP channel — one inbound normalizer + one outbound formatter that collapse the platform into GatewayMessage / GatewayResponse, with no change to the agent backend. Use when the maintainer says "add support for <platform>" (e.g. Matrix, LINE, Messenger, Mastodon) or a new channel appears in the connector registry.
---

# Skill: add-channel-adapter

## Trigger

- The maintainer asks to support a new platform: "add Matrix", "we need LINE", "wire up Messenger".
- A new channel id is added to `SUPPORTED_CHANNELS` / `ChannelTypeSchema` and needs an adapter.
- An existing channel needs a second provider (e.g. a Vapi-style alternate for voice).

## The contract you must satisfy

AIP has exactly two primitives. A channel adapter only has to do two jobs:

1. **Inbound:** map the platform's raw webhook/event shape → `GatewayMessage`
   (`{ id, channel, from, text, timestamp, threadId? }`).
2. **Outbound:** map `GatewayResponse` (`{ text, cards?, actions? }`) → the platform's native send shape.

The agent backend NEVER changes — it always speaks `{ text } in → { text } out`. If your change touches
`src/lib/built-in-agent.ts` or the agent HTTP contract, you are doing it wrong.

## Steps

1. **Register the channel id** (model tier: none): add it to `ChannelTypeSchema` in `src/adapters/types.ts`
   and to `SUPPORTED_CHANNELS` + the metadata maps in `src/lib/constants.ts`
   (`CHANNEL_TIERS`, `CHANNEL_DISPLAY_NAMES`, `CHANNEL_COSTS`, `CHANNEL_PROVIDERS`, ...). Keep all maps in sync.
2. **Add the inbound normalizer** (model tier: sonnet): extend `normalizeMessage()` in `src/lib/gateway.ts`
   with the platform's field names (its text field, its sender field, its timestamp). Prefer adding to the
   existing `??` fallback chains over branching — the function already handles Telegram-nested, Twilio
   `Body`/`From`, Slack `ts`, etc. Reuse those patterns.
3. **Add the outbound formatter** (model tier: sonnet): add a `case "<channel>"` to `formatResponse()` if the
   platform supports rich replies (buttons/cards); otherwise the `default` plain-`{ text }` branch is correct.
4. **(If webhook-based) add signature validation** (model tier: sonnet): add a validator in
   `src/lib/webhook-validation.ts` and a branch in `validateWebhook()` in `src/commands/serve.ts`.
   Mirror the Twilio HMAC-SHA1 / Slack HMAC-SHA256+replay / Telegram secret-token patterns already there.
5. **(If WebSocket-based, like Discord/Slack)** add a connector class under `src/adapters/` and register it in
   `connectWebSocketAdapters()` and `WEBSOCKET_CHANNELS` in `serve.ts`.
6. **Write a behavioral eval** (model tier: sonnet): add an inbound case to `L2-001` and an outbound case to
   `L2-002` in `eval/behavioral.test.ts` for the new channel.

## Model tier per step

Step 1: none · Steps 2-6: sonnet (small, surgical diffs).

## Verify (loop until green)

```bash
./node_modules/.bin/tsc                 # 0 type errors
./node_modules/.bin/vitest run          # all tests + your new behavioral case pass
node dist/index.js channels list        # new channel appears in the table
```

## Expected output

A diff touching only `types.ts`, `gateway.ts`, `constants.ts`, optionally `webhook-validation.ts`/`serve.ts`,
plus a new `eval/` case — and ZERO change to the agent backend contract. The new channel round-trips an inbound
event to a normalized `GatewayMessage` and back out to a platform-appropriate reply.

## Boundaries

Never change the `{ text } in → { text } out` agent contract. Never add live API calls to the test suite — keep
adapters mocked and deterministic. Never store platform credentials in the repo (they live in
`~/.agentdial/credentials/<channel>.json`, `0600`).
