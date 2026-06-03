/**
 * agentdial — Behavioral Evals (L2)
 *
 * These are user-perspective behavioral tests: they exercise the full
 * normalizeMessage → routeMessage → formatResponse pipeline the same way an
 * inbound message from a real platform would.
 *
 * The "golden" criteria:
 *   1. Each inbound channel shape is accepted and produces a valid GatewayMessage.
 *   2. The formatted response is channel-appropriate (not a raw blob).
 *   3. Routing correctly calls the agent backend with the right payload.
 *   4. Edge cases (empty text, missing sender, oversized text) are handled gracefully.
 *
 * Run: npx vitest run eval/behavioral.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeMessage, formatResponse, routeMessage } from "../src/lib/gateway.js";
import { GatewayMessageSchema, ChannelTypeSchema } from "../src/adapters/types.js";
import type { GatewayResponse, ChannelType } from "../src/adapters/types.js";

// ── Helpers ──

function agentReply(text: string): Response {
  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const AGENT_URL = "http://localhost:8080/agent";

// ── L2-001: Per-channel inbound normalization (behavioral) ──

describe("L2-001 inbound normalization — all channel shapes", () => {
  const cases: Array<{
    channel: ChannelType;
    label: string;
    raw: Record<string, unknown>;
    expectedText: string;
    expectedFrom: string;
  }> = [
    {
      channel: "telegram",
      label: "Telegram native nested format",
      raw: {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: { id: 9876, username: "alice", first_name: "Alice" },
          chat: { id: 9876, type: "private" },
          date: 1717000000,
          text: "Book a table for 2",
        },
      },
      expectedText: "Book a table for 2",
      expectedFrom: "9876",
    },
    {
      channel: "discord",
      label: "Discord content+userId format",
      raw: {
        content: "What time is it?",
        userId: "discord_user_42",
        threadId: "thread_99",
        timestamp: 1717000100,
      },
      expectedText: "What time is it?",
      expectedFrom: "discord_user_42",
    },
    {
      channel: "slack",
      label: "Slack ts+user_id format",
      raw: {
        text: "Schedule standup",
        user_id: "U0ABCXYZ",
        ts: "1717000200.000000",
      },
      expectedText: "Schedule standup",
      expectedFrom: "U0ABCXYZ",
    },
    {
      channel: "sms",
      label: "Twilio SMS Body+From",
      raw: {
        Body: "remind me tomorrow",
        From: "+15551234567",
        To: "+15557654321",
        MessageSid: "SMxxx",
      },
      expectedText: "remind me tomorrow",
      expectedFrom: "+15551234567",
    },
    {
      channel: "whatsapp",
      label: "Twilio WhatsApp Body+From",
      raw: {
        Body: "hello whatsapp",
        From: "whatsapp:+15551234567",
        To: "whatsapp:+15557654321",
      },
      expectedText: "hello whatsapp",
      expectedFrom: "whatsapp:+15551234567",
    },
    {
      channel: "email",
      label: "SendGrid inbound parse",
      raw: {
        text: "Please help with my order",
        from: "customer@example.com",
        sender: "customer@example.com",
        timestamp: 1717000300,
      },
      expectedText: "Please help with my order",
      expectedFrom: "customer@example.com",
    },
    {
      channel: "voice",
      label: "Twilio voice SpeechResult",
      raw: {
        SpeechResult: "call me back in ten minutes",
        From: "+15559876543",
        CallSid: "CAyyy",
      },
      expectedText: "call me back in ten minutes",
      expectedFrom: "+15559876543",
    },
  ];

  for (const tc of cases) {
    it(`[${tc.channel}] ${tc.label}`, () => {
      const msg = normalizeMessage(tc.raw, tc.channel);

      // Assertion: valid GatewayMessage
      const parsed = GatewayMessageSchema.safeParse(msg);
      expect(parsed.success, `GatewayMessage parse failed: ${JSON.stringify(parsed)}`).toBe(true);

      // Assertion: correct channel
      expect(msg.channel).toBe(tc.channel);

      // Assertion: text extracted
      expect(msg.text).toBe(tc.expectedText);

      // Assertion: sender extracted
      expect(msg.from).toBe(tc.expectedFrom);

      // Assertion: id is a non-empty string
      expect(msg.id.length).toBeGreaterThan(0);

      // Assertion: timestamp is a positive number
      expect(msg.timestamp).toBeGreaterThan(0);
    });
  }
});

// ── L2-002: formatResponse output shape per channel (behavioral) ──

describe("L2-002 formatResponse — channel-appropriate output shapes", () => {
  const fullResponse: GatewayResponse = {
    text: "Here is your answer",
    cards: [{ title: "Card One", description: "Desc" }],
    actions: [
      { label: "Learn More", type: "url", value: "https://example.com" },
      { label: "Got it", type: "callback", value: "ack" },
    ],
  };

  it("[telegram] payload has text + reply_markup with inline keyboard", () => {
    const result = formatResponse(fullResponse, "telegram");
    expect(result.channel).toBe("telegram");
    expect(typeof result.payload.text).toBe("string");
    expect(result.payload.parse_mode).toBe("Markdown");
    const markup = result.payload.reply_markup as { inline_keyboard: unknown[][] };
    expect(Array.isArray(markup.inline_keyboard)).toBe(true);
    expect(markup.inline_keyboard[0]).toHaveLength(2);
  });

  it("[discord] payload has content + embeds array", () => {
    const result = formatResponse(fullResponse, "discord");
    expect(result.channel).toBe("discord");
    expect(typeof result.payload.content).toBe("string");
    const embeds = result.payload.embeds as unknown[];
    expect(Array.isArray(embeds)).toBe(true);
    expect(embeds.length).toBeGreaterThan(0);
  });

  it("[slack] payload has text + blocks with mrkdwn section", () => {
    const result = formatResponse(fullResponse, "slack");
    expect(result.channel).toBe("slack");
    expect(typeof result.payload.text).toBe("string");
    const blocks = result.payload.blocks as Array<{ type: string }>;
    expect(blocks.some((b) => b.type === "section")).toBe(true);
  });

  it("[sms] payload is plain { text }", () => {
    const result = formatResponse({ text: "SMS reply" }, "sms");
    expect(result.payload.text).toBe("SMS reply");
    expect(Object.keys(result.payload)).toEqual(["text"]);
  });

  it("[voice] payload is plain { text } (TTS source)", () => {
    const result = formatResponse({ text: "Voice reply" }, "voice");
    expect(result.payload.text).toBe("Voice reply");
  });

  it("all supported channels produce a non-empty payload", () => {
    const channels = ChannelTypeSchema.options;
    for (const ch of channels) {
      const result = formatResponse({ text: `Hello from ${ch}` }, ch);
      // Every channel must return *some* payload — the content field name varies by channel
      // (telegram/discord/slack use text or content; others use text)
      const payloadKeys = Object.keys(result.payload);
      expect(payloadKeys.length, `${ch} produced empty payload`).toBeGreaterThan(0);
    }
  });
});

// ── L2-003: Full pipeline — inbound → routeMessage → formatResponse ──

describe("L2-003 full pipeline (mock agent backend)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("telegram message flows through to formatted Telegram reply", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(agentReply("Booked for 2 at 7pm!"));

    const raw = {
      message: {
        message_id: 5,
        from: { id: 111, first_name: "Bob" },
        chat: { id: 111, type: "private" },
        date: 1717001000,
        text: "Book a table for 2 at 7pm",
      },
    };

    const msg = normalizeMessage(raw, "telegram");
    const agentResponse = await routeMessage(msg, AGENT_URL);
    const formatted = formatResponse(agentResponse, "telegram");

    expect(formatted.channel).toBe("telegram");
    expect(formatted.payload.text).toBe("Booked for 2 at 7pm!");
    expect(formatted.payload.parse_mode).toBe("Markdown");
  });

  it("SMS message flows through and produces plain text reply", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(agentReply("Reminder set!"));

    const raw = { Body: "remind me at noon", From: "+15550001111" };
    const msg = normalizeMessage(raw, "sms");
    const agentResponse = await routeMessage(msg, AGENT_URL);
    const formatted = formatResponse(agentResponse, "sms");

    expect(formatted.payload.text).toBe("Reminder set!");
  });

  it("routeMessage sends GatewayMessage body to agent URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      agentReply("pong"),
    );

    const raw = { text: "ping", from: "u1", timestamp: 1717001100 };
    const msg = normalizeMessage(raw, "discord");
    await routeMessage(msg, AGENT_URL);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(AGENT_URL);
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
    expect(body.channel).toBe("discord");
    expect(body.text).toBe("ping");
  });

  it("routeMessage throws when agent returns non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const msg = normalizeMessage({ text: "hi", from: "u2" }, "slack");
    await expect(routeMessage(msg, AGENT_URL)).rejects.toThrow("503");
  });
});

// ── L2-004: Edge cases (behavioral, not structural) ──

describe("L2-004 edge cases", () => {
  it("empty text message is accepted — empty string, not crash", () => {
    const msg = normalizeMessage({ from: "u1" }, "telegram");
    expect(msg.text).toBe("");
    expect(msg.from).toBe("u1");
  });

  it("missing sender falls back to 'unknown', not crash", () => {
    const msg = normalizeMessage({ text: "orphan" }, "sms");
    expect(msg.from).toBe("unknown");
    expect(msg.text).toBe("orphan");
  });

  it("very long text (>4000 chars) normalizes without truncation", () => {
    const longText = "a".repeat(5000);
    const msg = normalizeMessage({ text: longText, from: "u3" }, "discord");
    expect(msg.text.length).toBe(5000);
  });

  it("message with all optional fields preserves them", () => {
    const msg = normalizeMessage(
      {
        text: "rich msg",
        from: "u4",
        threadId: "t-99",
        timestamp: 1717002000,
        nativeId: "native-abc-123",
      },
      "slack",
    );
    expect(msg.threadId).toBe("t-99");
    expect(msg.timestamp).toBe(1717002000);
    expect(msg.id).toBe("native-abc-123");
  });
});
