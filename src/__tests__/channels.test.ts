import { describe, it, expect, vi, beforeEach } from "vitest";

// A config left by the old setup wizard, which enabled `web` by default.
vi.mock("../lib/config.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/config.js")>()),
  loadConfig: vi.fn(async () => ({
    channels: { web: { channel: "web", enabled: true } },
  })),
  updateConfig: vi.fn(async () => undefined),
}));
vi.mock("../lib/credentials.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/credentials.js")>()),
  listCredentials: vi.fn(async () => []),
  listConfiguredChannels: vi.fn(async () => []),
}));
vi.mock("../lib/ui.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ui.js")>()),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  heading: vi.fn(),
  table: vi.fn(),
}));

import {
  cmdChannelAdd,
  cmdChannelList,
  cmdChannelTest,
} from "../commands/channels.js";
import { updateConfig } from "../lib/config.js";
import { warn, table } from "../lib/ui.js";
import type { TableRow } from "../lib/ui.js";
import { hasAdapter } from "../adapters/index.js";
import {
  SUPPORTED_CHANNELS,
  PLANNED_CHANNELS,
  channelNames,
  plannedChannelNote,
} from "../lib/constants.js";

describe("planned channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("are exactly the listed channels that have no adapter", () => {
    const withoutAdapter = SUPPORTED_CHANNELS.filter((ch) => !hasAdapter(ch));
    expect([...PLANNED_CHANNELS].sort()).toEqual([...withoutAdapter].sort());
  });

  it("are marked in the channel names that help text and errors show", () => {
    const names = channelNames();
    expect(names).toContain("imessage (planned)");
    expect(names).toContain("web (planned)");
    expect(names).not.toContain("telegram (planned)");
  });

  it.each(["imessage", "web"])(
    "`channels add %s` says it is planned and enables nothing",
    async (channel) => {
      await cmdChannelAdd(channel);
      expect(updateConfig).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(plannedChannelNote(channel));
    },
  );

  it("the web note points at the gateway endpoint that works today", () => {
    expect(plannedChannelNote("web")).toContain("POST");
    expect(plannedChannelNote("web")).toContain("/message");
    expect(plannedChannelNote("imessage")).toBe(
      "iMessage is planned: agentdial has no adapter for it yet.",
    );
  });

  it("`channels list` shows both as planned, even when an old config enabled web", async () => {
    await cmdChannelList();
    const rows = vi.mocked(table).mock.calls[0][1] as TableRow[];
    const status = (name: string): string =>
      rows.find((r) => r["Channel"] === name)?.["Status"] ?? "";
    expect(status("iMessage")).toContain("planned");
    expect(status("Web Widget")).toContain("planned");
    expect(status("Telegram")).not.toContain("planned");
  });

  it("`channels test web` says it is planned instead of asking for credentials", async () => {
    await cmdChannelTest("web");
    expect(warn).toHaveBeenCalledWith(plannedChannelNote("web"));
  });
});
