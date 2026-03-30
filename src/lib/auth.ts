/**
 * AgentDial Auth Layer
 *
 * Handles:
 * 1. Clerk OAuth device flow (login via browser → JWT stored locally)
 * 2. Managed Twilio sub-accounts (auto-provision per user)
 * 3. Auto-provision flow on signup (email via AgentMail, phone via Twilio)
 * 4. Token refresh and session management
 */

import { readFile, writeFile, mkdir, unlink, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { CONFIG_DIR } from "./constants.js";
import { startOAuthFlow } from "./oauth-server.js";
import { basicAuth, TWILIO_API_BASE } from "./twilio.js";

// ── Paths ──

const AUTH_FILE = join(CONFIG_DIR, "auth.json");
const AUTH_CALLBACK_PORT = 7891;

// ── Clerk Configuration ──
// These are the Energy platform Clerk credentials.
// The publishable key is safe to embed — it's a client-side identifier.
// The actual Clerk instance URL is derived from the publishable key.

const ClerkConfigSchema = z.object({
  /** Clerk publishable key (client-side, safe to embed) */
  publishableKey: z.string().default("pk_live_placeholder"),
  /** Clerk frontend API URL — e.g. https://your-app.clerk.accounts.dev */
  frontendApi: z.string().default("https://accounts.agentdial.com"),
  /** OAuth authorize endpoint — Clerk's standard path */
  authorizeEndpoint: z.string().default("/oauth/authorize"),
  /** Token endpoint — for exchanging code → JWT */
  tokenEndpoint: z.string().default("/oauth/token"),
  /** Userinfo endpoint — for fetching user profile */
  userinfoEndpoint: z.string().default("/oauth/userinfo"),
  /** AgentDial API base — for managed sub-accounts */
  apiBase: z.string().default("https://api.agentdial.com"),
});

type ClerkConfig = z.infer<typeof ClerkConfigSchema>;

// ── Auth Session (stored in ~/.agentdial/auth.json) ──

export const AuthSessionSchema = z.object({
  /** JWT access token from Clerk */
  accessToken: z.string(),
  /** Refresh token (if available) */
  refreshToken: z.string().optional(),
  /** Token expiry timestamp (ms) */
  expiresAt: z.number(),
  /** User ID from Clerk */
  userId: z.string(),
  /** User email */
  email: z.string().optional(),
  /** Display name */
  name: z.string().optional(),
  /** Clerk organization ID (if user belongs to one) */
  orgId: z.string().optional(),
  /** Managed sub-account IDs created on behalf of this user */
  managedAccounts: z
    .object({
      twilioSubAccountSid: z.string().optional(),
      agentMailInboxId: z.string().optional(),
      sendGridSubuserId: z.string().optional(),
    })
    .optional(),
});

export type AuthSession = z.infer<typeof AuthSessionSchema>;

// ── Managed Sub-Account Types ──

export const TwilioSubAccountSchema = z.object({
  sid: z.string(),
  authToken: z.string(),
  friendlyName: z.string(),
  status: z.enum(["active", "suspended", "closed"]),
  ownerAccountSid: z.string(),
});

export type TwilioSubAccount = z.infer<typeof TwilioSubAccountSchema>;

export const AutoProvisionResultSchema = z.object({
  email: z
    .object({
      ok: z.boolean(),
      provider: z.string(),
      address: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
  phone: z
    .object({
      ok: z.boolean(),
      number: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
  channels: z.array(
    z.object({
      channel: z.string(),
      provisioned: z.boolean(),
      error: z.string().optional(),
    }),
  ),
});

export type AutoProvisionResult = z.infer<typeof AutoProvisionResultSchema>;

// ── Load/Save Auth Session ──

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (!existsSync(AUTH_FILE)) return null;

  try {
    const raw = await readFile(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return AuthSessionSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(AUTH_FILE, JSON.stringify(session, null, 2) + "\n", "utf-8");
  await chmod(AUTH_FILE, 0o600);
}

export async function clearAuthSession(): Promise<void> {
  if (existsSync(AUTH_FILE)) {
    await unlink(AUTH_FILE);
  }
}

// ── Auth State Checks ──

export async function isAuthenticated(): Promise<boolean> {
  const session = await loadAuthSession();
  if (!session) return false;
  // Check if token is expired (with 60s buffer)
  return session.expiresAt > Date.now() + 60_000;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await loadAuthSession();
  if (!session)
    throw new Error("Not authenticated. Run `agentdial login` first.");
  if (session.expiresAt <= Date.now() + 60_000) {
    // Try refresh
    const refreshed = await refreshAccessToken(session);
    if (refreshed) return { Authorization: `Bearer ${refreshed.accessToken}` };
    throw new Error(
      "Session expired. Run `agentdial login` to re-authenticate.",
    );
  }
  return { Authorization: `Bearer ${session.accessToken}` };
}

// ── Clerk OAuth Device Flow ──

export interface LoginOptions {
  /** Override Clerk config (for self-hosted instances) */
  clerkConfig?: Partial<ClerkConfig>;
  /** Port for local OAuth callback server */
  callbackPort?: number;
  /** Timeout for OAuth flow in ms */
  timeout?: number;
}

/**
 * Initiate Clerk OAuth login flow.
 * Opens browser → user authenticates → callback with code → exchange for JWT.
 */
export async function login(options?: LoginOptions): Promise<AuthSession> {
  const config = ClerkConfigSchema.parse(options?.clerkConfig ?? {});
  const port = options?.callbackPort ?? AUTH_CALLBACK_PORT;
  const redirectUri = `http://localhost:${String(port)}/callback`;
  const state = randomBytes(16).toString("hex");

  // Build authorization URL
  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: config.publishableKey,
    redirect_uri: redirectUri,
    state,
    scope: "profile email",
  });

  const authorizeUrl = `${config.frontendApi}${config.authorizeEndpoint}?${authorizeParams.toString()}`;

  // Start OAuth flow (opens browser, waits for callback)
  const result = await startOAuthFlow({
    authorizeUrl,
    port,
    timeout: options?.timeout ?? 120_000,
    successHtml: LOGIN_SUCCESS_HTML,
  });

  // Verify state
  if (result.state && result.state !== state) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Aborting.");
  }

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(
    config,
    result.code,
    redirectUri,
  );

  // Fetch user info
  const userInfo = await fetchUserInfo(config, tokenResponse.accessToken);

  const session: AuthSession = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
    userId: userInfo.userId,
    email: userInfo.email,
    name: userInfo.name,
  };

  await saveAuthSession(session);
  return session;
}

// ── Token Exchange ──

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string(),
});

async function exchangeCodeForTokens(
  config: ClerkConfig,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.publishableKey,
  });

  const res = await fetch(`${config.frontendApi}${config.tokenEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = TokenResponseSchema.parse(await res.json());
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

// ── Token Refresh ──

async function refreshAccessToken(
  session: AuthSession,
): Promise<AuthSession | null> {
  if (!session.refreshToken) return null;

  const config = ClerkConfigSchema.parse({});
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: config.publishableKey,
  });

  try {
    const res = await fetch(`${config.frontendApi}${config.tokenEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) return null;

    const data = TokenResponseSchema.parse(await res.json());
    const refreshed: AuthSession = {
      ...session,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await saveAuthSession(refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

// ── User Info ──

interface UserInfo {
  userId: string;
  email?: string;
  name?: string;
}

const UserInfoResponseSchema = z.object({
  sub: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
});

async function fetchUserInfo(
  config: ClerkConfig,
  accessToken: string,
): Promise<UserInfo> {
  const res = await fetch(`${config.frontendApi}${config.userinfoEndpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // Fallback: decode JWT claims (Clerk JWTs have sub + email in payload)
    return extractUserInfoFromJwt(accessToken);
  }

  const data = UserInfoResponseSchema.parse(await res.json());
  const name =
    (data.name ??
      [data.given_name, data.family_name].filter(Boolean).join(" ")) ||
    undefined;
  return { userId: data.sub, email: data.email, name };
}

function extractUserInfoFromJwt(jwt: string): UserInfo {
  try {
    const parts = jwt.split(".");
    const payload = parts[1];
    if (!payload) throw new Error("Invalid JWT");
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    ) as Record<string, unknown>;
    return {
      userId: (decoded.sub as string) ?? "unknown",
      email: decoded.email as string | undefined,
      name: decoded.name as string | undefined,
    };
  } catch {
    return { userId: "unknown" };
  }
}

// ── Managed Twilio Sub-Accounts ──

/**
 * Create a Twilio sub-account for a user.
 * Requires a master Twilio account (Energy's account) with sub-account permissions.
 */
export async function createTwilioSubAccount(
  masterSid: string,
  masterToken: string,
  friendlyName: string,
): Promise<TwilioSubAccount> {
  const params = new URLSearchParams({
    FriendlyName: friendlyName,
  });

  const res = await fetch(`${TWILIO_API_BASE}${masterSid}/Accounts.json`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(masterSid, masterToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to create Twilio sub-account (${res.status}): ${text}`,
    );
  }

  const data = (await res.json()) as {
    sid: string;
    auth_token: string;
    friendly_name: string;
    status: string;
    owner_account_sid: string;
  };

  return TwilioSubAccountSchema.parse({
    sid: data.sid,
    authToken: data.auth_token,
    friendlyName: data.friendly_name,
    status: data.status,
    ownerAccountSid: data.owner_account_sid,
  });
}

/**
 * Buy a phone number on a Twilio sub-account and configure webhooks.
 */
export async function provisionTwilioNumber(
  subAccountSid: string,
  subAccountToken: string,
  webhookBaseUrl: string,
  options?: { country?: string; areaCode?: string },
): Promise<{ number: string; sid: string }> {
  const country = options?.country ?? "US";
  const searchParams = new URLSearchParams({
    SmsEnabled: "true",
    VoiceEnabled: "true",
    PageSize: "1",
  });
  if (options?.areaCode) searchParams.set("AreaCode", options.areaCode);

  // Search for available number
  const searchRes = await fetch(
    `${TWILIO_API_BASE}${subAccountSid}/AvailablePhoneNumbers/${country}/Local.json?${searchParams.toString()}`,
    { headers: { Authorization: basicAuth(subAccountSid, subAccountToken) } },
  );

  if (!searchRes.ok) {
    throw new Error(`Number search failed (${searchRes.status})`);
  }

  const searchData = (await searchRes.json()) as {
    available_phone_numbers: Array<{ phone_number: string }>;
  };

  const available = searchData.available_phone_numbers?.[0];
  if (!available) {
    throw new Error("No phone numbers available in the requested area");
  }

  // Buy the number
  const buyParams = new URLSearchParams({
    PhoneNumber: available.phone_number,
    SmsUrl: `${webhookBaseUrl}/webhook/sms`,
    SmsMethod: "POST",
    VoiceUrl: `${webhookBaseUrl}/webhook/voice`,
    VoiceMethod: "POST",
    FriendlyName: "agentdial-auto",
  });

  const buyRes = await fetch(
    `${TWILIO_API_BASE}${subAccountSid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(subAccountSid, subAccountToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buyParams.toString(),
    },
  );

  if (!buyRes.ok) {
    const text = await buyRes.text();
    throw new Error(`Failed to buy number (${buyRes.status}): ${text}`);
  }

  const buyData = (await buyRes.json()) as {
    phone_number: string;
    sid: string;
  };

  return { number: buyData.phone_number, sid: buyData.sid };
}

// ── AgentMail Auto-Provision ──

export interface AgentMailInbox {
  id: string;
  address: string;
}

const AgentMailResponseSchema = z.object({
  id: z.string(),
  address: z.string(),
});

/**
 * Create an AgentMail inbox for the user.
 * AgentMail provides zero-friction agent email (1 API call).
 */
export async function createAgentMailInbox(
  apiKey: string,
  agentName: string,
): Promise<AgentMailInbox> {
  const res = await fetch("https://api.agentmail.to/v1/inboxes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: agentName,
      display_name: agentName,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AgentMail inbox creation failed (${res.status}): ${text}`);
  }

  const data = AgentMailResponseSchema.parse(await res.json());
  return { id: data.id, address: data.address };
}

// ── Auto-Provision Flow ──

export interface AutoProvisionOptions {
  /** User's display name (for sub-account naming) */
  userName: string;
  /** User's agent name (for inbox/number naming) */
  agentName: string;
  /** Webhook base URL for configuring callbacks */
  webhookBaseUrl?: string;
  /** Master Twilio credentials (Energy's account) for sub-account creation */
  twilioMasterSid?: string;
  twilioMasterToken?: string;
  /** AgentMail API key */
  agentMailApiKey?: string;
  /** Skip specific providers */
  skipEmail?: boolean;
  skipPhone?: boolean;
}

/**
 * Auto-provision channels on signup.
 *
 * Flow:
 * 1. Email via AgentMail (zero friction) — if API key available
 * 2. Phone via Twilio sub-account (if master creds + paid plan) — auto-buy number
 * 3. Return results for each channel
 */
export async function autoProvision(
  options: AutoProvisionOptions,
): Promise<AutoProvisionResult> {
  const channels: Array<{
    channel: string;
    provisioned: boolean;
    error?: string;
  }> = [];

  let emailResult: AutoProvisionResult["email"];
  let phoneResult: AutoProvisionResult["phone"];

  // 1. Email via AgentMail
  if (!options.skipEmail && options.agentMailApiKey) {
    try {
      const inbox = await createAgentMailInbox(
        options.agentMailApiKey,
        options.agentName,
      );
      emailResult = {
        ok: true,
        provider: "agentmail",
        address: inbox.address,
      };
      channels.push({ channel: "email", provisioned: true });
    } catch (err) {
      emailResult = {
        ok: false,
        provider: "agentmail",
        error: err instanceof Error ? err.message : String(err),
      };
      channels.push({
        channel: "email",
        provisioned: false,
        error: emailResult.error,
      });
    }
  } else if (!options.skipEmail) {
    channels.push({
      channel: "email",
      provisioned: false,
      error: "No AgentMail API key configured",
    });
  }

  // 2. Phone via Twilio sub-account
  if (
    !options.skipPhone &&
    options.twilioMasterSid &&
    options.twilioMasterToken
  ) {
    try {
      const subAccount = await createTwilioSubAccount(
        options.twilioMasterSid,
        options.twilioMasterToken,
        `agentdial-${options.userName}`,
      );

      const webhookBase = options.webhookBaseUrl ?? "https://api.agentdial.com";
      const number = await provisionTwilioNumber(
        subAccount.sid,
        subAccount.authToken,
        webhookBase,
      );

      phoneResult = { ok: true, number: number.number };
      channels.push({ channel: "sms", provisioned: true });
      channels.push({ channel: "voice", provisioned: true });
      channels.push({
        channel: "whatsapp",
        provisioned: false,
        error: "Requires sandbox opt-in",
      });
    } catch (err) {
      phoneResult = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      channels.push({
        channel: "sms",
        provisioned: false,
        error: phoneResult.error,
      });
    }
  } else if (!options.skipPhone) {
    channels.push({
      channel: "sms",
      provisioned: false,
      error: "No Twilio master credentials configured",
    });
  }

  // 3. Token-based channels (user must paste tokens — not auto-provisionable)
  channels.push({
    channel: "telegram",
    provisioned: false,
    error: "Requires manual BotFather setup (tier 1: paste token)",
  });
  channels.push({
    channel: "discord",
    provisioned: false,
    error: "Requires Discord Dev Portal setup (tier 2: create app)",
  });
  channels.push({
    channel: "slack",
    provisioned: false,
    error: "Requires 1-click OAuth install (tier 2: auto via manifest API)",
  });

  return { email: emailResult, phone: phoneResult, channels };
}

// ── HTML Templates ──

const LOGIN_SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>AgentDial — Logged In</title>
  <style>
    body {
      background: #141312;
      color: #E5E7EB;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      text-align: center;
      padding: 3rem;
      border: 1px solid #2D2D2D;
      border-radius: 12px;
      background: #1A1918;
      max-width: 400px;
    }
    h1 { color: #8B5CF6; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #9CA3AF; font-size: 0.95rem; }
    .check { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>Logged in to AgentDial</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>
`;
