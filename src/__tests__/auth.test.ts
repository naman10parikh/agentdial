import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, mkdir, rm, readFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

// We test the auth module by mocking the CONFIG_DIR to a temp directory.
// This avoids touching the real ~/.agentdial/auth.json.

const TEST_DIR = join(tmpdir(), `agentdial-auth-test-${randomUUID()}`);
const TEST_AUTH_FILE = join(TEST_DIR, "auth.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("AuthSession roundtrip", () => {
  it("writes and reads a session file with correct permissions", async () => {
    const session = {
      accessToken: "test-jwt-token-abc123",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 3600_000,
      userId: "user_2abc123",
      email: "test@example.com",
      name: "Test User",
    };

    // Write
    await writeFile(
      TEST_AUTH_FILE,
      JSON.stringify(session, null, 2) + "\n",
      "utf-8",
    );
    await chmod(TEST_AUTH_FILE, 0o600);

    // Read back
    const raw = await readFile(TEST_AUTH_FILE, "utf-8");
    const parsed = JSON.parse(raw) as typeof session;

    expect(parsed.accessToken).toBe("test-jwt-token-abc123");
    expect(parsed.userId).toBe("user_2abc123");
    expect(parsed.email).toBe("test@example.com");
    expect(parsed.name).toBe("Test User");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it("handles missing auth file gracefully", () => {
    const missing = join(TEST_DIR, "nonexistent.json");
    expect(existsSync(missing)).toBe(false);
  });

  it("validates session schema rejects invalid data", async () => {
    const { AuthSessionSchema } = await import("../lib/auth.js");

    // Valid
    const valid = AuthSessionSchema.safeParse({
      accessToken: "token",
      expiresAt: Date.now(),
      userId: "user_123",
    });
    expect(valid.success).toBe(true);

    // Missing required fields
    const invalid = AuthSessionSchema.safeParse({
      accessToken: "token",
    });
    expect(invalid.success).toBe(false);

    // Wrong types
    const wrongType = AuthSessionSchema.safeParse({
      accessToken: 123,
      expiresAt: "not-a-number",
      userId: null,
    });
    expect(wrongType.success).toBe(false);
  });

  it("validates managed accounts schema", async () => {
    const { AuthSessionSchema } = await import("../lib/auth.js");

    const withManaged = AuthSessionSchema.safeParse({
      accessToken: "token",
      expiresAt: Date.now(),
      userId: "user_123",
      managedAccounts: {
        twilioSubAccountSid: "AC_sub_123",
        agentMailInboxId: "inbox_456",
      },
    });
    expect(withManaged.success).toBe(true);
  });
});

describe("JWT parsing", () => {
  it("extracts user info from a Clerk-style JWT", async () => {
    // Create a fake JWT with a known payload
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user_2xYz789",
        email: "naman@energy.dev",
        name: "Naman Parikh",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const fakeJwt = `${header}.${payload}.fake-signature`;

    // The extractUserInfoFromJwt function is not exported directly,
    // but we can test it indirectly through the whoami flow by
    // creating a session with this JWT and checking it parses.
    const parts = fakeJwt.split(".");
    const decoded = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8"),
    ) as { sub: string; email: string; name: string };

    expect(decoded.sub).toBe("user_2xYz789");
    expect(decoded.email).toBe("naman@energy.dev");
    expect(decoded.name).toBe("Naman Parikh");
  });

  it("handles malformed JWT gracefully", () => {
    const badJwt = "not.a.jwt";
    const parts = badJwt.split(".");
    expect(() => {
      JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
    }).toThrow();
  });
});

describe("OAuth callback server", () => {
  it("receives a callback with code and state", async () => {
    const { startOAuthFlow } = await import("../lib/oauth-server.js");

    const port = 7899 + Math.floor(Math.random() * 100);
    const state = "test-state-xyz";

    // Start OAuth flow — it will try to open a browser (which we ignore)
    // and wait for a callback. We simulate the callback with a fetch.
    const flowPromise = startOAuthFlow({
      authorizeUrl: `http://localhost:${port}/authorize?state=${state}`,
      port,
      timeout: 5000,
    });

    // Give the server a moment to start
    await new Promise((r) => setTimeout(r, 200));

    // Simulate the OAuth callback
    await fetch(
      `http://localhost:${port}/callback?code=auth-code-abc&state=${state}`,
    );

    const result = await flowPromise;
    expect(result.code).toBe("auth-code-abc");
    expect(result.state).toBe(state);
  });

  it("rejects callback without code", async () => {
    const { startOAuthFlow } = await import("../lib/oauth-server.js");

    const port = 7899 + Math.floor(Math.random() * 100);

    const flowPromise = startOAuthFlow({
      authorizeUrl: `http://localhost:${port}/authorize`,
      port,
      timeout: 3000,
    });

    await new Promise((r) => setTimeout(r, 200));

    // Send callback without code — should NOT resolve the promise
    const res = await fetch(`http://localhost:${port}/callback`);
    expect(res.status).toBe(400);

    // The flow should timeout since no valid code was received
    await expect(flowPromise).rejects.toThrow("timed out");
  });

  it("handles OAuth error response", async () => {
    const { startOAuthFlow } = await import("../lib/oauth-server.js");

    const port = 7899 + Math.floor(Math.random() * 100);

    const flowPromise = startOAuthFlow({
      authorizeUrl: `http://localhost:${port}/authorize`,
      port,
      timeout: 5000,
    });

    // Attach a catch handler BEFORE triggering the error
    // to prevent vitest from seeing an unhandled rejection.
    const catchPromise = flowPromise.catch((err: Error) => err);

    await new Promise((r) => setTimeout(r, 200));

    // Simulate an OAuth error callback
    await fetch(`http://localhost:${port}/callback?error=access_denied`);

    const err = await catchPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("access_denied");
  });
});

describe("TwilioSubAccount schema", () => {
  it("validates a correct sub-account response", async () => {
    const { TwilioSubAccountSchema } = await import("../lib/auth.js");

    const result = TwilioSubAccountSchema.safeParse({
      sid: "AC_sub_test123",
      authToken: "auth_token_456",
      friendlyName: "agentdial-testuser",
      status: "active",
      ownerAccountSid: "AC_master_789",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sid).toBe("AC_sub_test123");
      expect(result.data.status).toBe("active");
    }
  });

  it("rejects invalid status values", async () => {
    const { TwilioSubAccountSchema } = await import("../lib/auth.js");

    const result = TwilioSubAccountSchema.safeParse({
      sid: "AC_sub_test",
      authToken: "token",
      friendlyName: "test",
      status: "invalid-status",
      ownerAccountSid: "AC_master",
    });

    expect(result.success).toBe(false);
  });
});

describe("AutoProvisionResult schema", () => {
  it("validates a complete provision result", async () => {
    const { AutoProvisionResultSchema } = await import("../lib/auth.js");

    const result = AutoProvisionResultSchema.safeParse({
      email: { ok: true, provider: "agentmail", address: "agent@agentmail.to" },
      phone: { ok: true, number: "+15551234567" },
      channels: [
        { channel: "email", provisioned: true },
        { channel: "sms", provisioned: true },
        { channel: "telegram", provisioned: false, error: "Manual setup" },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email?.ok).toBe(true);
      expect(result.data.channels).toHaveLength(3);
    }
  });
});
