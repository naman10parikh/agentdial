import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeMessage,
  formatResponse,
  routeMessage,
} from "../lib/gateway.js";
import {
  GatewayMessageSchema,
  GatewayResponseSchema,
} from "../adapters/types.js";
import type { GatewayResponse, ChannelType } from "../adapters/types.js";

describe("normalizeMessage", () => {
  it("normalizes a raw Telegram message", () => {
    const raw = {
      text: "Hello from Telegram",
      from: "user123",
      chatId: "chat456",
      date: 1711630800,
    };

    const msg = normalizeMessage(raw, "telegram");

    expect(msg.channel).toBe("telegram");
    expect(msg.text).toBe("Hello from Telegram");
    expect(msg.from).toBe("user123");
    expect(msg.threadId).toBe("chat456");
    expect(msg.timestamp).toBe(1711630800);
    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe("string");
  });

  it("normalizes a raw Discord message with content field", () => {
    const raw = {
      content: "Hello from Discord",
      userId: "discord_user",
      threadId: "thread_789",
      timestamp: 1711630900,
    };

    const msg = normalizeMessage(raw, "discord");

    expect(msg.channel).toBe("discord");
    expect(msg.text).toBe("Hello from Discord");
    expect(msg.from).toBe("discord_user");
    expect(msg.threadId).toBe("thread_789");
  });

  it("normalizes a raw Slack message with ts field", () => {
    const raw = {
      text: "Hello from Slack",
      user_id: "U12345",
      ts: "1711630800.000100",
    };

    const msg = normalizeMessage(raw, "slack");

    expect(msg.channel).toBe("slack");
    expect(msg.text).toBe("Hello from Slack");
    expect(msg.from).toBe("U12345");
    // Slack ts is seconds with decimals, converted to ms
    expect(msg.timestamp).toBe(1711630800000);
  });

  it("falls back to empty string when no text field found", () => {
    const raw = { from: "someone" };
    const msg = normalizeMessage(raw, "sms");

    expect(msg.text).toBe("");
    expect(msg.from).toBe("someone");
  });

  it("falls back to unknown when no from field found", () => {
    const raw = { text: "orphan message" };
    const msg = normalizeMessage(raw, "email");

    expect(msg.from).toBe("unknown");
  });

  it("uses body field for SMS-style messages", () => {
    const raw = {
      body: "Hello via SMS body",
      sender: "+15551234567",
    };

    const msg = normalizeMessage(raw, "sms");

    expect(msg.text).toBe("Hello via SMS body");
    expect(msg.from).toBe("+15551234567");
  });

  it("uses Date.now() as fallback timestamp", () => {
    const before = Date.now();
    const raw = { text: "no timestamp" };
    const msg = normalizeMessage(raw, "web");
    const after = Date.now();

    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });

  it("produces a valid GatewayMessage (Zod-parseable)", () => {
    const raw = {
      text: "validate me",
      from: "tester",
      timestamp: 1711630800,
    };

    const msg = normalizeMessage(raw, "telegram");
    const result = GatewayMessageSchema.safeParse(msg);

    expect(result.success).toBe(true);
  });
});

describe("formatResponse", () => {
  const baseResponse: GatewayResponse = {
    text: "Hello from the agent",
  };

  const responseWithActions: GatewayResponse = {
    text: "Pick one:",
    actions: [
      { label: "Visit site", type: "url", value: "https://example.com" },
      { label: "Confirm", type: "callback", value: "confirm_action" },
    ],
  };

  const responseWithCards: GatewayResponse = {
    text: "Here are results:",
    cards: [
      {
        title: "Result 1",
        description: "First result",
        imageUrl: "https://example.com/img.jpg",
      },
    ],
  };

  it("formats for Telegram with Markdown parse_mode", () => {
    const result = formatResponse(baseResponse, "telegram");

    expect(result.channel).toBe("telegram");
    expect(result.payload.text).toBe("Hello from the agent");
    expect(result.payload.parse_mode).toBe("Markdown");
  });

  it("formats Telegram actions as inline keyboard", () => {
    const result = formatResponse(responseWithActions, "telegram");
    const markup = result.payload.reply_markup as {
      inline_keyboard: Array<
        Array<{ text: string; url?: string; callback_data?: string }>
      >;
    };

    expect(markup).toBeDefined();
    expect(markup.inline_keyboard).toHaveLength(1);
    expect(markup.inline_keyboard[0]).toHaveLength(2);
    expect(markup.inline_keyboard[0][0].url).toBe("https://example.com");
    expect(markup.inline_keyboard[0][1].callback_data).toBe("confirm_action");
  });

  it("formats for Discord with content and embeds", () => {
    const result = formatResponse(responseWithCards, "discord");

    expect(result.channel).toBe("discord");
    expect(result.payload.content).toBe("Here are results:");

    const embeds = result.payload.embeds as Array<{
      title: string;
      description?: string;
      image?: { url: string };
    }>;
    expect(embeds).toHaveLength(1);
    expect(embeds[0].title).toBe("Result 1");
    expect(embeds[0].description).toBe("First result");
    expect(embeds[0].image?.url).toBe("https://example.com/img.jpg");
  });

  it("formats for Slack with blocks", () => {
    const result = formatResponse(baseResponse, "slack");

    expect(result.channel).toBe("slack");
    expect(result.payload.text).toBe("Hello from the agent");

    const blocks = result.payload.blocks as Array<{
      type: string;
      text?: { type: string; text: string };
    }>;
    expect(blocks).toBeDefined();
    expect(blocks[0].type).toBe("section");
    expect(blocks[0].text?.type).toBe("mrkdwn");
  });

  it("formats Slack actions as block elements", () => {
    const result = formatResponse(responseWithActions, "slack");
    const blocks = result.payload.blocks as Array<{
      type: string;
      elements?: Array<{ type: string; text: { type: string; text: string } }>;
    }>;

    // First block is the section, remaining are actions
    const actionBlocks = blocks.filter((b) => b.type === "actions");
    expect(actionBlocks.length).toBeGreaterThan(0);
  });

  it("uses plain text fallback for unsupported channels", () => {
    const channels: ChannelType[] = [
      "sms",
      "whatsapp",
      "email",
      "voice",
      "teams",
      "messenger",
      "web",
    ];

    for (const ch of channels) {
      const result = formatResponse(baseResponse, ch);
      expect(result.channel).toBe(ch);
      expect(result.payload.text).toBe("Hello from the agent");
    }
  });
});

describe("routeMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends message to agent backend and returns parsed response", async () => {
    const mockResponse = { text: "Agent says hello" };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const msg = normalizeMessage(
      { text: "hi", from: "user1", timestamp: 1711630800 },
      "telegram",
    );

    const result = await routeMessage(msg, "http://localhost:8080/agent");

    expect(result.text).toBe("Agent says hello");
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8080/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
      signal: expect.any(AbortSignal),
    });

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sentBody.text).toBe("hi");
    expect(sentBody.channel).toBe("telegram");
  });

  it("throws on non-OK response from agent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const msg = normalizeMessage(
      { text: "fail", from: "user1", timestamp: 1 },
      "telegram",
    );

    await expect(
      routeMessage(msg, "http://localhost:8080/agent"),
    ).rejects.toThrow("Agent returned 500");
  });

  it("throws on invalid JSON response from agent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"invalid": true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const msg = normalizeMessage(
      { text: "bad", from: "user1", timestamp: 1 },
      "telegram",
    );

    // GatewayResponseSchema requires text field
    await expect(
      routeMessage(msg, "http://localhost:8080/agent"),
    ).rejects.toThrow();
  });

  it("sends correct Content-Type header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const msg = normalizeMessage(
      { text: "test", from: "user1", timestamp: 1 },
      "discord",
    );

    await routeMessage(msg, "http://localhost:8080/agent");

    const headers = fetchSpy.mock.calls[0][1]!.headers as Record<
      string,
      string
    >;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
