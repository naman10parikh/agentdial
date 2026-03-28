import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  parseIdentity,
  writeIdentity,
  validateIdentity,
} from "../lib/identity.js";
import { IdentitySchema } from "../adapters/types.js";

const TEST_DIR = join(tmpdir(), `agentdial-test-${randomUUID()}`);

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("parseIdentity", () => {
  it("parses a valid IDENTITY.md with all fields", async () => {
    const content = `---
name: spark
tagline: Your AI concierge
version: "1.0.0"
agent_url: http://localhost:8080/agent
channels:
  telegram:
    enabled: true
    handle: "@spark_bot"
  discord:
    enabled: false
---

# Spark

> Your AI concierge

## Personality

Friendly and helpful.
`;
    const filePath = join(TEST_DIR, "IDENTITY.md");
    await writeFile(filePath, content, "utf-8");

    const identity = await parseIdentity(filePath);

    expect(identity.name).toBe("spark");
    expect(identity.tagline).toBe("Your AI concierge");
    expect(identity.version).toBe("1.0.0");
    expect(identity.agent_url).toBe("http://localhost:8080/agent");
    expect(identity.channels?.telegram?.enabled).toBe(true);
    expect(identity.channels?.telegram?.handle).toBe("@spark_bot");
    expect(identity.channels?.discord?.enabled).toBe(false);
  });

  it("parses a minimal IDENTITY.md with only name", async () => {
    const content = `---
name: minimal-agent
---

# Minimal Agent
`;
    const filePath = join(TEST_DIR, "minimal.md");
    await writeFile(filePath, content, "utf-8");

    const identity = await parseIdentity(filePath);

    expect(identity.name).toBe("minimal-agent");
    expect(identity.version).toBe("1.0.0"); // default
    expect(identity.tagline).toBeUndefined();
    expect(identity.agent_url).toBeUndefined();
    expect(identity.channels).toBeUndefined();
  });

  it("throws when file does not exist", async () => {
    const filePath = join(TEST_DIR, "nonexistent.md");
    await expect(parseIdentity(filePath)).rejects.toThrow(
      "Identity file not found",
    );
  });

  it("throws when no frontmatter is present", async () => {
    const content = `# No Frontmatter

Just a plain markdown file.
`;
    const filePath = join(TEST_DIR, "no-front.md");
    await writeFile(filePath, content, "utf-8");

    await expect(parseIdentity(filePath)).rejects.toThrow(
      "No YAML frontmatter found",
    );
  });

  it("throws when required name field is missing", async () => {
    const content = `---
tagline: Missing the name field
version: "1.0.0"
---

# Oops
`;
    const filePath = join(TEST_DIR, "no-name.md");
    await writeFile(filePath, content, "utf-8");

    await expect(parseIdentity(filePath)).rejects.toThrow();
  });
});

describe("writeIdentity", () => {
  it("writes and re-reads an identity file", async () => {
    const filePath = join(TEST_DIR, "output.md");
    const identity = {
      name: "roundtrip-agent",
      tagline: "Testing roundtrip",
      version: "2.0.0",
      agent_url: "http://localhost:9090/agent",
    };

    await writeIdentity(filePath, identity);
    const parsed = await parseIdentity(filePath);

    expect(parsed.name).toBe("roundtrip-agent");
    expect(parsed.tagline).toBe("Testing roundtrip");
    expect(parsed.version).toBe("2.0.0");
    expect(parsed.agent_url).toBe("http://localhost:9090/agent");
  });

  it("writes with custom body content", async () => {
    const filePath = join(TEST_DIR, "custom-body.md");
    const identity = { name: "custom-agent" };
    const body = "# Custom\n\nThis is custom content.";

    await writeIdentity(filePath, identity, body);
    const parsed = await parseIdentity(filePath);

    expect(parsed.name).toBe("custom-agent");
  });

  it("generates default body with personality/capabilities/boundaries sections", async () => {
    const { readFile } = await import("node:fs/promises");
    const filePath = join(TEST_DIR, "default-body.md");
    const identity = { name: "default-agent", tagline: "Test tagline" };

    await writeIdentity(filePath, identity);
    const raw = await readFile(filePath, "utf-8");

    expect(raw).toContain("# default-agent");
    expect(raw).toContain("> Test tagline");
    expect(raw).toContain("## Personality");
    expect(raw).toContain("## Capabilities");
    expect(raw).toContain("## Boundaries");
  });
});

describe("validateIdentity", () => {
  it("validates a correct identity object", () => {
    const result = validateIdentity({
      name: "valid-agent",
      tagline: "A valid agent",
      version: "1.0.0",
    });

    expect(result.name).toBe("valid-agent");
    expect(result.tagline).toBe("A valid agent");
  });

  it("applies default version when omitted", () => {
    const result = validateIdentity({ name: "no-version" });
    expect(result.version).toBe("1.0.0");
  });

  it("rejects when name is missing", () => {
    expect(() => validateIdentity({ tagline: "no name here" })).toThrow();
  });

  it("rejects when name is not a string", () => {
    expect(() => validateIdentity({ name: 123 })).toThrow();
  });
});

describe("IdentitySchema (Zod)", () => {
  it("parses a full identity with channels", () => {
    const result = IdentitySchema.parse({
      name: "zod-agent",
      tagline: "Validated by Zod",
      version: "1.0.0",
      agent_url: "http://localhost:3000",
      channels: {
        telegram: { enabled: true, handle: "@bot" },
        discord: { enabled: false },
      },
    });

    expect(result.name).toBe("zod-agent");
    expect(result.channels?.telegram?.enabled).toBe(true);
    expect(result.channels?.telegram?.handle).toBe("@bot");
    expect(result.channels?.discord?.enabled).toBe(false);
  });

  it("rejects unknown channel types", () => {
    expect(() =>
      IdentitySchema.parse({
        name: "bad-channel",
        channels: {
          fax: { enabled: true },
        },
      }),
    ).toThrow();
  });

  it("provides defaults for missing optional fields", () => {
    const result = IdentitySchema.parse({ name: "defaults-agent" });
    expect(result.version).toBe("1.0.0");
    expect(result.tagline).toBeUndefined();
    expect(result.channels).toBeUndefined();
  });
});
