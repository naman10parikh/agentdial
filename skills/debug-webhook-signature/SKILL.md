---
name: debug-webhook-signature
description: Diagnose why an inbound platform webhook is being rejected with 403 "invalid webhook signature" (or silently dropped) at the agentdial gateway. Use when a real Telegram/Twilio/Slack message reaches the gateway but the agent never replies, or `serve` logs a 403 on /webhook/<channel>.
---

# Skill: debug-webhook-signature

## Trigger

- A live message hits `agentdial serve` but the agent never responds.
- The gateway returns `403 { "error": "Forbidden: invalid webhook signature" }`.
- A channel "works in test" (`agentdial test`) but fails with real platform traffic.

## Mental model

Inbound traffic flows: platform → `/webhook/:channel` → `validateWebhook()` (in `src/commands/serve.ts`) →
`normalizeMessage()` → agent. `validateWebhook()` returns `true` to REJECT. Each platform signs differently
(`src/lib/webhook-validation.ts`):

- **Twilio (sms/whatsapp/voice):** HMAC-SHA1 over the full webhook URL + sorted POST params, header
  `x-twilio-signature`. The URL must match EXACTLY what Twilio called (scheme/host incl. tunnel) — the #1 cause
  of false rejects behind a tunnel is `x-forwarded-proto`/`x-forwarded-host` not being honored.
- **Slack:** HMAC-SHA256 over `v0:{timestamp}:{rawBody}`, header `x-slack-signature`, plus a 5-min replay
  window on `x-slack-request-timestamp`. A clock skew or a re-read (consumed) body breaks this.
- **Telegram:** constant-time compare of the `x-telegram-bot-api-secret-token` header to the stored
  `webhook_secret`.

Key rule: if NO credential is stored for the channel, `validateWebhook()` returns `false` (allow) — so a 403
means a credential IS stored and the signature genuinely failed.

## Steps

1. **Confirm which channel + that a credential exists** (model tier: none):
   ```bash
   node dist/index.js channels list      # is the channel "active"? does it have creds?
   node dist/index.js status --json      # machine-readable channel state
   ```
2. **Reproduce with the raw body** (model tier: none): capture the exact payload + headers the platform sent
   (use `--tunnel` and the provider's webhook-debug console). The signature is computed over the *raw* body and
   the *exact* URL — re-serializing JSON or stripping a trailing slash will break the HMAC.
3. **Check the URL the validator reconstructs** (model tier: sonnet): in `validateWebhook()`, for Twilio the URL
   is `${proto}://${host}${req.url}`. Behind a tunnel, `proto` must come from `x-forwarded-proto` and `host`
   from `x-forwarded-host`. If your tunnel doesn't set these, the HMAC base string is wrong → false reject.
4. **Check timestamp skew (Slack)** (model tier: sonnet): if the machine clock is off >5 min, replay protection
   rejects. Verify `x-slack-request-timestamp` is within the window.
5. **Verify the secret matches** (model tier: none): confirm the stored credential equals the one configured in
   the platform console (`~/.agentdial/credentials/<channel>.json`). A rotated token in the console but not
   locally is a silent mismatch.
6. **Add a regression test** (model tier: sonnet): once root-caused, add a case to `src/__tests__/` that feeds a
   correctly-signed and an incorrectly-signed payload and asserts allow/reject — so it never regresses.

## Model tier per step

Steps 1, 2, 5: none · Steps 3, 4, 6: sonnet.

## Expected output

A one-line root cause (e.g. "tunnel didn't forward `x-forwarded-proto`, so Twilio HMAC base URL was `http` not
`https`") + the surgical fix + a regression test. Never the non-answer "signatures don't match."

## Boundaries

Never disable signature validation to "make it work" — that opens the gateway to spoofed inbound messages.
Never log raw tokens or full signed URLs (they can carry secrets) — strip query params first.
