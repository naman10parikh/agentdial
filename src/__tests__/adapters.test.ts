import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdapter, getAllAdapters, hasAdapter } from "../adapters/index.js";
import type { ChannelAdapter, ChannelType } from "../adapters/types.js";

describe("adapter registry", () => {
  it("returns all registered adapters", () => {
    const adapters = getAllAdapters();

    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters.length).toBe(7); // telegram, discord, slack, sms, whatsapp, email, voice
  });

  it("all adapters implement the ChannelAdapter interface", () => {
    const adapters = getAllAdapters();

    for (const adapter of adapters) {
      // Required readonly properties
      expect(typeof adapter.name).toBe("string");
      expect(typeof adapter.displayName).toBe("string");
      expect(typeof adapter.free).toBe("boolean");
      expect(typeof adapter.setupTime).toBe("string");

      // Required methods
      expect(typeof adapter.setup).toBe("function");
      expect(typeof adapter.connect).toBe("function");
      expect(typeof adapter.disconnect).toBe("function");
      expect(typeof adapter.send).toBe("function");
      expect(typeof adapter.onMessage).toBe("function");
      expect(typeof adapter.test).toBe("function");
      expect(typeof adapter.status).toBe("function");
    }
  });

  it("each adapter has a unique name", () => {
    const adapters = getAllAdapters();
    const names = adapters.map((a) => a.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  it("each adapter has a non-empty display name", () => {
    const adapters = getAllAdapters();

    for (const adapter of adapters) {
      expect(adapter.displayName.length).toBeGreaterThan(0);
    }
  });

  it("free channels are correctly flagged", () => {
    const telegram = getAdapter("telegram");
    const discord = getAdapter("discord");

    expect(telegram.free).toBe(true);
    expect(discord.free).toBe(true);

    const sms = getAdapter("sms");
    const whatsapp = getAdapter("whatsapp");

    expect(sms.free).toBe(false);
    expect(whatsapp.free).toBe(false);
  });
});

describe("getAdapter", () => {
  it("retrieves a known adapter by channel type", () => {
    const adapter = getAdapter("telegram");

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("telegram");
  });

  it("throws for unregistered channel type", () => {
    // teams, messenger, web don't have adapters yet
    expect(() => getAdapter("teams" as ChannelType)).toThrow(
      "No adapter for channel",
    );
    expect(() => getAdapter("messenger" as ChannelType)).toThrow(
      "No adapter for channel",
    );
    expect(() => getAdapter("web" as ChannelType)).toThrow(
      "No adapter for channel",
    );
  });
});

describe("hasAdapter", () => {
  it("returns true for registered channels", () => {
    expect(hasAdapter("telegram")).toBe(true);
    expect(hasAdapter("discord")).toBe(true);
    expect(hasAdapter("slack")).toBe(true);
    expect(hasAdapter("sms")).toBe(true);
    expect(hasAdapter("whatsapp")).toBe(true);
    expect(hasAdapter("email")).toBe(true);
  });

  it("returns true for voice channel", () => {
    expect(hasAdapter("voice")).toBe(true);
  });

  it("returns false for unregistered channels", () => {
    expect(hasAdapter("teams")).toBe(false);
    expect(hasAdapter("messenger")).toBe(false);
    expect(hasAdapter("web")).toBe(false);
  });
});

describe("adapter.test() without credentials", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("telegram test returns error when no token configured", async () => {
    // Mock getCredential to return undefined (no stored credentials)
    vi.mock("../lib/credentials.js", () => ({
      getCredential: vi.fn().mockResolvedValue(undefined),
      saveCredential: vi.fn().mockResolvedValue(undefined),
      listCredentials: vi.fn().mockResolvedValue([]),
      deleteCredential: vi.fn().mockResolvedValue(false),
      listConfiguredChannels: vi.fn().mockResolvedValue([]),
    }));

    // Import fresh adapter with mocked credentials
    const { TelegramAdapter } = await import("../adapters/telegram.js");
    const adapter = new TelegramAdapter();
    const result = await adapter.test();

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });
});

describe("adapter.status()", () => {
  it("all adapters return valid ChannelStatus shape", async () => {
    // Mock credentials so adapters don't hit real APIs
    vi.mock("../lib/credentials.js", () => ({
      getCredential: vi.fn().mockResolvedValue(undefined),
      saveCredential: vi.fn().mockResolvedValue(undefined),
      listCredentials: vi.fn().mockResolvedValue([]),
      deleteCredential: vi.fn().mockResolvedValue(false),
      listConfiguredChannels: vi.fn().mockResolvedValue([]),
    }));

    const adapters = getAllAdapters();

    for (const adapter of adapters) {
      const status = await adapter.status();

      expect(status).toHaveProperty("channel");
      expect(status).toHaveProperty("connected");
      expect(status).toHaveProperty("latencyMs");
      expect(status).toHaveProperty("lastMessage");
      expect(status).toHaveProperty("error");
      expect(typeof status.connected).toBe("boolean");
      expect(status.channel).toBe(adapter.name);
    }
  });
});

describe("adapter.onMessage()", () => {
  it("all adapters accept a message handler without throwing", () => {
    const adapters = getAllAdapters();
    const handler = vi.fn();

    for (const adapter of adapters) {
      expect(() => adapter.onMessage(handler)).not.toThrow();
    }
  });
});
