/**
 * Webhook signature validation for incoming channel webhooks.
 * Uses Node.js built-in crypto — no external dependencies.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ── Twilio (SMS, WhatsApp, Voice) ──

/**
 * Validate Twilio X-Twilio-Signature header.
 * Algorithm: HMAC-SHA1 of (webhook URL + sorted POST body params) keyed by Auth Token.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!authToken || !url || !signature) return false;

  // Build data string: URL + sorted param keys with their values appended
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + (params[key] ?? "");
  }

  const computed = createHmac("sha1", authToken).update(data).digest("base64");

  // Timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(computed, "utf-8");
    const b = Buffer.from(signature, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Slack ──

/**
 * Validate Slack X-Slack-Signature header.
 * Algorithm: HMAC-SHA256 of "v0:{timestamp}:{rawBody}" keyed by signing secret.
 * Rejects if timestamp is older than 5 minutes (replay prevention).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function validateSlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  if (!signingSecret || !timestamp || !signature) return false;

  // Replay prevention: reject requests older than 5 minutes
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const basestring = `v0:${timestamp}:${body}`;
  const computed =
    "v0=" +
    createHmac("sha256", signingSecret).update(basestring).digest("hex");

  // Timing-safe comparison
  try {
    const a = Buffer.from(computed, "utf-8");
    const b = Buffer.from(signature, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Telegram ──

/**
 * Validate Telegram webhook by checking the secret token header.
 * Telegram supports an optional X-Telegram-Bot-Api-Secret-Token header
 * set when registering the webhook via setWebhook({ secret_token }).
 * @see https://core.telegram.org/bots/api#setwebhook
 */
export function validateTelegramSecret(
  expectedSecret: string,
  headerSecret: string,
): boolean {
  if (!expectedSecret || !headerSecret) return false;

  try {
    const a = Buffer.from(expectedSecret, "utf-8");
    const b = Buffer.from(headerSecret, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
